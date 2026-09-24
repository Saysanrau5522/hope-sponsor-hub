import { WorkerEnv } from '../middleware/access';
import { getGmailAccessToken } from './gmail';
import { classifyIncomingMessage, extractEmailAddress } from '../../shared/replies';

export interface InboxPollResult {
  checkedCount: number;
  newRepliesCount: number;
  newBouncesCount: number;
  newAutoRepliesCount: number;
  errors: string[];
}

/**
 * Polls Gmail inbox for incoming messages, classifies them, and updates D1
 * Strictly respects Cloudflare Free Tier constraints (< 50 subrequests, < 10ms CPU)
 */
export async function pollInboxTick(env: WorkerEnv): Promise<InboxPollResult> {
  const result: InboxPollResult = {
    checkedCount: 0,
    newRepliesCount: 0,
    newBouncesCount: 0,
    newAutoRepliesCount: 0,
    errors: [],
  };

  const db = env.DB;

  // 1. Check if Gmail is connected
  const tokenRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'gmail_refresh_token_encrypted'")
    .first<{ value: string }>();

  if (!tokenRow?.value) {
    // Gmail not connected yet; skip polling
    return result;
  }

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken(env);
  } catch (err: any) {
    result.errors.push(`Token retrieval error: ${err.message}`);
    return result;
  }

  // 2. Fetch list of recent messages from Gmail (cap at 20 to safely limit subrequests)
  // Limit maxResults=20 -> at most 1 list call + 20 detail calls = 21 subrequests
  const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox';
  let messagesList: Array<{ id: string; threadId: string }> = [];

  try {
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      result.errors.push(`Gmail list error: ${listRes.status} ${errText}`);
      return result;
    }

    const data = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
    messagesList = data.messages || [];
  } catch (err: any) {
    result.errors.push(`Fetch messages error: ${err.message}`);
    return result;
  }

  if (messagesList.length === 0) {
    return result;
  }

  result.checkedCount = messagesList.length;

  // 3. Filter out messages already stored in replies_bounces
  const messageIds = messagesList.map((m) => m.id);
  const placeholders = messageIds.map(() => '?').join(',');
  const existingRows = await db
    .prepare(`SELECT gmail_message_id FROM replies_bounces WHERE gmail_message_id IN (${placeholders})`)
    .bind(...messageIds)
    .all<{ gmail_message_id: string }>();

  const existingSet = new Set((existingRows.results || []).map((r) => r.gmail_message_id));
  const newMessages = messagesList.filter((m) => !existingSet.has(m.id));

  const now = new Date().toISOString();

  // 4. Inspect new messages
  for (const msg of newMessages) {
    try {
      const detailUrl =
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata` +
        '&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To' +
        '&metadataHeaders=References&metadataHeaders=Auto-Submitted&metadataHeaders=X-Autoreply' +
        '&metadataHeaders=X-Failed-Recipients&metadataHeaders=Date';

      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!detailRes.ok) continue;

      const detailData = (await detailRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        internalDate?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
        };
      };

      const headers = detailData.payload?.headers || [];
      const snippet = detailData.snippet || '';

      const classification = classifyIncomingMessage({
        headers,
        snippet,
      });

      // 5. Match message to outreach / sponsor
      let sponsorId: number | null = null;
      let outreachId: number | null = null;

      // Strategy A: Match by thread ID
      const outreachByThread = await db
        .prepare('SELECT id, sponsor_id FROM outreaches WHERE gmail_thread_id = ? LIMIT 1')
        .bind(msg.threadId)
        .first<{ id: number; sponsor_id: number }>();

      if (outreachByThread) {
        sponsorId = outreachByThread.sponsor_id;
        outreachId = outreachByThread.id;
      }

      // Strategy B: Match by In-Reply-To / References
      if (!sponsorId && classification.inReplyTo) {
        const cleanedInReplyTo = classification.inReplyTo.trim();
        const outreachByRfc = await db
          .prepare('SELECT id, sponsor_id FROM outreaches WHERE rfc822_message_id = ? LIMIT 1')
          .bind(cleanedInReplyTo)
          .first<{ id: number; sponsor_id: number }>();

        if (outreachByRfc) {
          sponsorId = outreachByRfc.sponsor_id;
          outreachId = outreachByRfc.id;
        }
      }

      // Strategy C: Bounce recipient match
      if (!sponsorId && classification.failedRecipient) {
        const outreachByRecipient = await db
          .prepare('SELECT id, sponsor_id FROM outreaches WHERE recipient_email = ? ORDER BY id DESC LIMIT 1')
          .bind(classification.failedRecipient)
          .first<{ id: number; sponsor_id: number }>();

        if (outreachByRecipient) {
          sponsorId = outreachByRecipient.sponsor_id;
          outreachId = outreachByRecipient.id;
        } else {
          const sponsorByEmail = await db
            .prepare('SELECT id FROM sponsors WHERE primary_email = ? LIMIT 1')
            .bind(classification.failedRecipient)
            .first<{ id: number }>();
          if (sponsorByEmail) {
            sponsorId = sponsorByEmail.id;
          }
        }
      }

      // Strategy D: Match by sender email
      if (!sponsorId && classification.sender) {
        const senderClean = extractEmailAddress(classification.sender);
        const sponsorBySender = await db
          .prepare('SELECT id FROM sponsors WHERE primary_email = ? OR alt_emails LIKE ? LIMIT 1')
          .bind(senderClean, `%${senderClean}%`)
          .first<{ id: number }>();

        if (sponsorBySender) {
          sponsorId = sponsorBySender.id;
          const latestOutreach = await db
            .prepare('SELECT id FROM outreaches WHERE sponsor_id = ? ORDER BY id DESC LIMIT 1')
            .bind(sponsorId)
            .first<{ id: number }>();
          if (latestOutreach) outreachId = latestOutreach.id;
        }
      }

      // Received timestamp
      const receivedAt = detailData.internalDate
        ? new Date(parseInt(detailData.internalDate, 10)).toISOString()
        : now;

      // 6. Record in replies_bounces table
      await db
        .prepare(
          `INSERT INTO replies_bounces (
            sponsor_id, outreach_id, gmail_message_id, gmail_thread_id,
            type, sender, snippet, status_code, parsed_reason, received_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          sponsorId,
          outreachId,
          msg.id,
          msg.threadId,
          classification.type,
          classification.sender,
          classification.snippet,
          classification.statusCode,
          classification.parsedReason,
          receivedAt
        )
        .run();

      // 7. Update sponsor state based on classification
      if (sponsorId) {
        if (classification.type === 'bounce_hard') {
          await db
            .prepare("UPDATE sponsors SET stage = 'bounced', email_status = 'bounced_hard', updated_at = ? WHERE id = ?")
            .bind(now, sponsorId)
            .run();
          result.newBouncesCount++;

          await db
            .prepare(
              'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(sponsorId, 'system', 'hard_bounce_detected', `Hard bounce (${classification.statusCode || '5.x.x'}) for ${classification.sender}`, now)
            .run();
        } else if (classification.type === 'bounce_soft') {
          await db
            .prepare("UPDATE sponsors SET email_status = 'bounced_soft', updated_at = ? WHERE id = ?")
            .bind(now, sponsorId)
            .run();
          result.newBouncesCount++;

          await db
            .prepare(
              'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(sponsorId, 'system', 'soft_bounce_detected', `Soft bounce (${classification.statusCode || '4.x.x'}) for ${classification.sender}`, now)
            .run();
        } else if (classification.type === 'reply') {
          await db
            .prepare("UPDATE sponsors SET stage = 'replied', updated_at = ? WHERE id = ?")
            .bind(now, sponsorId)
            .run();
          result.newRepliesCount++;

          await db
            .prepare(
              'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(sponsorId, 'system', 'reply_received', `Received reply from ${classification.sender}: "${classification.snippet.slice(0, 60)}"`, now)
            .run();
        } else if (classification.type === 'auto_reply') {
          // Auto reply received, log it but do not mark sponsor as replied
          result.newAutoRepliesCount++;

          await db
            .prepare(
              'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(sponsorId, 'system', 'auto_reply_received', `Auto-reply received: "${classification.snippet.slice(0, 60)}"`, now)
            .run();
        }
      }
    } catch (err: any) {
      result.errors.push(`Error processing message ${msg.id}: ${err.message}`);
    }
  }

  // 8. Record last sync in settings
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('last_inbox_sync_at', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(now, now)
    .run();

  return result;
}
