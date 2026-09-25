import { WorkerEnv } from '../middleware/access';
import { Sponsor, Outreach } from '../../shared/types';
import { getMYTParts, isInsideSendWindowMYT, formatLetterDateMYT } from '../../shared/time';
import { generateTrackingToken } from '../../shared/crypto';
import { generateLetter, setCachedTemplate } from '../../shared/letter';
import { buildMimeMessage, sanitizeAsciiFilename } from '../../shared/mime';
import { sendGmailMimeMessage, searchSentByMessageId } from './gmail';
import { VERBATIM_EMAIL_SUBJECT } from '../../shared/constants';

export interface BatchReviewSummary {
  eligibleCount: number;
  firstCompany: { id: number; name: string; ref_no: string } | null;
  lastCompany: { id: number; name: string; ref_no: string } | null;
  estimatedFinishDays: number;
  warnings: {
    sharedInboxesCount: number;
    freemailCount: number;
    suspiciousDomainCount: number;
  };
}

export interface DailyQuotaStats {
  sentToday: number;
  cap: number;
  remainingToday: number;
  insideWindow: boolean;
  dayString: string;
}

/**
 * Get batch approval review summary
 */
export async function getBatchReviewSummary(env: WorkerEnv): Promise<BatchReviewSummary> {
  const db = env.DB;

  // Eligible sponsors: not_contacted, valid email, not do_not_contact
  const countRes = await db
    .prepare(`
      SELECT COUNT(*) as count 
      FROM sponsors 
      WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0
    `)
    .first<{ count: number }>();
  const eligibleCount = countRes?.count || 0;

  const firstSponsor = await db
    .prepare(`
      SELECT id, company_name, ref_no 
      FROM sponsors 
      WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0 
      ORDER BY seq ASC LIMIT 1
    `)
    .first<{ id: number; company_name: string; ref_no: string }>();

  const lastSponsor = await db
    .prepare(`
      SELECT id, company_name, ref_no 
      FROM sponsors 
      WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0 
      ORDER BY seq DESC LIMIT 1
    `)
    .first<{ id: number; company_name: string; ref_no: string }>();

  // Warnings
  const warningsRes = await db
    .prepare(`
      SELECT 
        SUM(CASE WHEN email_status = 'shared_inbox' THEN 1 ELSE 0 END) as shared_inboxes,
        SUM(CASE WHEN flags LIKE '%freemail%' AND email_status = 'valid' AND stage = 'not_contacted' THEN 1 ELSE 0 END) as freemail,
        SUM(CASE WHEN email_status = 'suspicious_domain' THEN 1 ELSE 0 END) as suspicious
      FROM sponsors
    `)
    .first<any>();

  // Estimated days based on ramp: Day 1: 25, Day 2: 50, Day 3+: 80
  let remaining = eligibleCount;
  let days = 0;
  if (remaining > 0) {
    days++;
    remaining -= Math.min(remaining, 25);
  }
  if (remaining > 0) {
    days++;
    remaining -= Math.min(remaining, 50);
  }
  if (remaining > 0) {
    days += Math.ceil(remaining / 80);
  }

  return {
    eligibleCount,
    firstCompany: firstSponsor
      ? { id: firstSponsor.id, name: firstSponsor.company_name, ref_no: firstSponsor.ref_no }
      : null,
    lastCompany: lastSponsor
      ? { id: lastSponsor.id, name: lastSponsor.company_name, ref_no: lastSponsor.ref_no }
      : null,
    estimatedFinishDays: days || 1,
    warnings: {
      sharedInboxesCount: warningsRes?.shared_inboxes || 0,
      freemailCount: warningsRes?.freemail || 0,
      suspiciousDomainCount: warningsRes?.suspicious || 0,
    },
  };
}

/**
 * Approve batch into the queue: creates outreaches and sets stage = 'queued'
 */
export async function approveBatch(
  env: WorkerEnv,
  userEmail: string,
  sponsorIds?: number[]
): Promise<{ count: number }> {
  const db = env.DB;
  const now = new Date().toISOString();

  let sponsorsToQueue: Sponsor[] = [];

  if (sponsorIds && sponsorIds.length > 0) {
    const placeholders = sponsorIds.map(() => '?').join(',');
    const res = await db
      .prepare(`
        SELECT * FROM sponsors 
        WHERE id IN (${placeholders}) AND primary_email IS NOT NULL AND do_not_contact = 0
      `)
      .bind(...sponsorIds)
      .all<Sponsor>();
    sponsorsToQueue = res.results || [];
  } else {
    const res = await db
      .prepare(`
        SELECT * FROM sponsors 
        WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0
        ORDER BY seq ASC
      `)
      .all<Sponsor>();
    sponsorsToQueue = res.results || [];
  }

  if (sponsorsToQueue.length === 0) {
    return { count: 0 };
  }

  // Batch insert into outreaches and update sponsors stage
  const statements: D1PreparedStatement[] = [];

  for (let i = 0; i < sponsorsToQueue.length; i++) {
    const s = sponsorsToQueue[i];
    const trackingToken = generateTrackingToken();
    const outreachId = `${s.id}_${Date.now()}_${i}`;
    const rfc822MsgId = `<hope-${outreachId}@hope-sponsor-hub>`;

    // First item due immediately, others staggered
    const nextDue = i === 0 ? now : null;

    statements.push(
      db
        .prepare(`
          INSERT INTO outreaches (
            sponsor_id, type, ref_no, recipient_email, subject, letter_date_text,
            rfc822_message_id, tracking_token, status, next_due_at, created_at
          ) VALUES (?, 'initial', ?, ?, ?, '', ?, ?, 'queued', ?, ?)
        `)
        .bind(s.id, s.ref_no, s.primary_email!, VERBATIM_EMAIL_SUBJECT, rfc822MsgId, trackingToken, nextDue, now)
    );

    statements.push(
      db
        .prepare("UPDATE sponsors SET stage = 'queued', updated_at = ? WHERE id = ?")
        .bind(now, s.id)
    );
  }

  // Execute in chunks of 50 to respect D1 batch limits
  for (let i = 0; i < statements.length; i += 50) {
    await db.batch(statements.slice(i, i + 50));
  }

  // Log activity
  await db
    .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
    .bind(
      userEmail,
      'approve_batch',
      `Approved batch of ${sponsorsToQueue.length} sponsors into outreach queue`,
      now
    )
    .run();

  return { count: sponsorsToQueue.length };
}

/**
 * Get daily quota and pacing statistics in MYT
 */
export async function getDailyQuotaStats(
  env: WorkerEnv,
  now: Date = new Date()
): Promise<DailyQuotaStats> {
  const db = env.DB;
  const parts = getMYTParts(now);
  const dayString = parts.dateString; // YYYY-MM-DD in MYT

  // Calculate UTC start and end for current MYT day
  // Since MYT is UTC+8: 00:00 MYT on YYYY-MM-DD = 16:00 UTC on previous calendar day
  const mytMidnightUTC = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
  const dayStartUTC = new Date(mytMidnightUTC.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const dayEndUTC = new Date(mytMidnightUTC.getTime() + 16 * 60 * 60 * 1000).toISOString();

  const countRes = await db
    .prepare(`
      SELECT COUNT(*) as sent_today 
      FROM outreaches 
      WHERE status = 'sent' AND sent_at >= ? AND sent_at < ?
    `)
    .bind(dayStartUTC, dayEndUTC)
    .first<{ sent_today: number }>();

  const sentToday = countRes?.sent_today || 0;

  // Determine cap from settings / ramp
  const capRow = await db.prepare("SELECT value FROM settings WHERE key = 'daily_cap'").first<{ value: string }>();
  const cap = parseInt(capRow?.value || '25', 10);

  const insideWindow = isInsideSendWindowMYT(now);
  const remainingToday = Math.max(0, cap - sentToday);

  return {
    sentToday,
    cap,
    remainingToday,
    insideWindow,
    dayString,
  };
}

/**
 * Process a single queue tick (called every minute by cron trigger or manually)
 */
export async function processQueueTick(
  env: WorkerEnv,
  now: Date = new Date(),
  forceSend = false
): Promise<{ processed: boolean; reason?: string; outreachId?: number; companyName?: string }> {
  const db = env.DB;

  // 1. Check global kill switch
  const sendEnabledRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'send_enabled'")
    .first<{ value: string }>();
  const isEnabled = env.SEND_ENABLED === 'true' || sendEnabledRow?.value === 'true';

  if (!isEnabled && !forceSend) {
    return { processed: false, reason: 'send_disabled' };
  }

  // 2. Check send window and daily quota
  const quota = await getDailyQuotaStats(env, now);

  if (!quota.insideWindow && !forceSend) {
    return { processed: false, reason: 'outside_send_window' };
  }

  if (quota.remainingToday <= 0 && !forceSend) {
    return { processed: false, reason: 'daily_cap_reached' };
  }

  // 3. Find at most one due outreach
  const nowISO = now.toISOString();
  const dueRow = await db
    .prepare(`
      SELECT 
        o.*,
        s.company_name,
        s.display_name,
        s.seq as sponsor_seq,
        s.ref_no as sponsor_ref_no
      FROM outreaches o
      JOIN sponsors s ON o.sponsor_id = s.id
      WHERE o.status = 'queued' AND (o.next_due_at IS NULL OR o.next_due_at <= ?)
      ORDER BY o.id ASC
      LIMIT 1
    `)
    .bind(nowISO)
    .first<any>();

  if (!dueRow) {
    return { processed: false, reason: 'no_due_outreaches' };
  }

  const outreachId = dueRow.id;
  const sponsorId = dueRow.sponsor_id;
  const companyName = dueRow.display_name || dueRow.company_name;

  // 4. Lock outreach to status = 'sending'
  await db
    .prepare("UPDATE outreaches SET status = 'sending' WHERE id = ?")
    .bind(outreachId)
    .run();
  await db
    .prepare("UPDATE sponsors SET stage = 'sending', updated_at = ? WHERE id = ?")
    .bind(nowISO, sponsorId)
    .run();

  try {
    // 5. Idempotency search in Gmail Sent (prevents double sends)
    const existingGmailMsgId = await searchSentByMessageId(dueRow.rfc822_message_id, env);
    if (existingGmailMsgId) {
      console.log(`[Queue Idempotency] Message ${dueRow.rfc822_message_id} already exists in Gmail Sent!`);
      await db
        .prepare(`
          UPDATE outreaches 
          SET status = 'sent', gmail_message_id = ?, sent_at = ? 
          WHERE id = ?
        `)
        .bind(existingGmailMsgId, nowISO, outreachId)
        .run();
      await db
        .prepare("UPDATE sponsors SET stage = 'sent', updated_at = ? WHERE id = ?")
        .bind(nowISO, sponsorId)
        .run();
      return { processed: true, outreachId, companyName, reason: 'recovered_via_idempotency' };
    }

    // 6. Load proposal PDF and letter template from R2
    let proposalBase64 = '';
    let templateBytes: Uint8Array | null = null;

    if (env.BUCKET) {
      const pObj = await env.BUCKET.get('assets/proposal.base64');
      if (pObj) proposalBase64 = await pObj.text();

      const tObj = await env.BUCKET.get('assets/template.docx');
      if (tObj) templateBytes = new Uint8Array(await tObj.arrayBuffer());
    }

    if (!proposalBase64) {
      proposalBase64 = btoa('%PDF-1.4\n%Proposal PDF\n%%EOF');
    }

    // 7. Generate Letter just-in-time dated today in MYT
    const companyInput = {
      company_name: dueRow.company_name,
      display_name: dueRow.display_name,
      ref_no: dueRow.ref_no,
      seq: dueRow.sponsor_seq,
    };
    const { docxBytes, refNo, dateText } = generateLetter(companyInput, now, templateBytes || undefined);

    // Save exact attached DOCX snapshot to R2
    const safeSlug = sanitizeAsciiFilename(companyName);
    const r2LetterPath = `sent/${refNo.replace(/\//g, '_')}-${safeSlug}.docx`;
    if (env.BUCKET) {
      await env.BUCKET.put(r2LetterPath, docxBytes);
    }

    // 8. Build MIME message
    const senderNameRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'sender_display_name'")
      .first<{ value: string }>();
    const senderEmailRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'sender_email'")
      .first<{ value: string }>();
    const dryRunRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'dry_run'")
      .first<{ value: string }>();

    const fromName = senderNameRow?.value || 'HOPE 5.0 | SSI USM';
    const fromEmail = senderEmailRow?.value || 'hopebyssi@gmail.com';
    const isDryRun = dryRunRow ? dryRunRow.value === 'true' : (env.DRY_RUN !== 'false');

    const mimeMessage = buildMimeMessage({
      fromName,
      fromEmail,
      toEmail: dueRow.recipient_email,
      companyName,
      subject: dueRow.subject,
      outreachId: dueRow.id,
      trackingToken: dueRow.tracking_token,
      pixelHost: env.PIXEL_HOST || 'localhost:8788',
      proposalBase64,
      letterDocxBytes: docxBytes,
    });

    // 9. Send through Gmail upload endpoint
    const sendRes = await sendGmailMimeMessage(mimeMessage, env, isDryRun);

    // 10. Mark success
    await db
      .prepare(`
        UPDATE outreaches 
        SET 
          status = 'sent',
          gmail_message_id = ?,
          gmail_thread_id = ?,
          letter_date_text = ?,
          letter_r2_path = ?,
          sent_at = ?
        WHERE id = ?
      `)
      .bind(sendRes.id, sendRes.threadId, dateText, r2LetterPath, nowISO, outreachId)
      .run();

    await db
      .prepare("UPDATE sponsors SET stage = 'sent', updated_at = ? WHERE id = ?")
      .bind(nowISO, sponsorId)
      .run();

    // 11. Schedule next queue item with random 60-180 s jitter
    const minDelay = parseInt((await db.prepare("SELECT value FROM settings WHERE key = 'random_delay_min_sec'").first<{ value: string }>())?.value || '60', 10);
    const maxDelay = parseInt((await db.prepare("SELECT value FROM settings WHERE key = 'random_delay_max_sec'").first<{ value: string }>())?.value || '180', 10);
    const jitterSec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    const nextDueTimestamp = new Date(now.getTime() + jitterSec * 1000).toISOString();

    await db
      .prepare(`
        UPDATE outreaches 
        SET next_due_at = ? 
        WHERE id = (SELECT id FROM outreaches WHERE status = 'queued' ORDER BY id ASC LIMIT 1)
      `)
      .bind(nextDueTimestamp)
      .run();

    return {
      processed: true,
      outreachId,
      companyName,
    };
  } catch (err: any) {
    console.error(`[Queue Error] Failed to send outreach ${outreachId}:`, err);

    // Determine error type: 4xx vs 5xx/network
    const isClientError = /4\d\d/.test(err.message) || err.message.includes('template error');

    if (isClientError) {
      // 4xx or template error: fail permanently without retry
      await db
        .prepare("UPDATE outreaches SET status = 'failed', failed_reason = ? WHERE id = ?")
        .bind(err.message, outreachId)
        .run();
      await db
        .prepare("UPDATE sponsors SET stage = 'failed', updated_at = ? WHERE id = ?")
        .bind(nowISO, sponsorId)
        .run();
    } else {
      // Network or 5xx: retry with backoff up to 3 times
      const retries = (dueRow.retry_count || 0) + 1;
      if (retries <= 3) {
        const backoffMs = retries * 5 * 60 * 1000; // 5m, 10m, 15m
        const retryDue = new Date(now.getTime() + backoffMs).toISOString();
        await db
          .prepare("UPDATE outreaches SET status = 'queued', retry_count = ?, next_due_at = ? WHERE id = ?")
          .bind(retries, retryDue, outreachId)
          .run();
        await db
          .prepare("UPDATE sponsors SET stage = 'queued', updated_at = ? WHERE id = ?")
          .bind(nowISO, sponsorId)
          .run();
      } else {
        await db
          .prepare("UPDATE outreaches SET status = 'failed', failed_reason = ? WHERE id = ?")
          .bind(`Exceeded 3 retries: ${err.message}`, outreachId)
          .run();
        await db
          .prepare("UPDATE sponsors SET stage = 'failed', updated_at = ? WHERE id = ?")
          .bind(nowISO, sponsorId)
          .run();
      }
    }

    return {
      processed: false,
      outreachId,
      companyName,
      reason: err.message,
    };
  }
}
