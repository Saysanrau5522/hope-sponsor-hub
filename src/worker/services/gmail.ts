import { WorkerEnv } from '../middleware/access';
import { decryptToken, encryptToken } from '../../shared/crypto';

// In-memory access token cache in worker isolate
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export interface GmailTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface GmailSendResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
}

/**
 * Get active Gmail access token using encrypted refresh token stored in D1.
 * Caches access token in isolate memory until 5 minutes before expiration.
 */
export async function getGmailAccessToken(env: WorkerEnv): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessToken.expiresAt - 5 * 60 * 1000) {
    return cachedAccessToken.token;
  }

  const db = env.DB;
  const tokenRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'gmail_refresh_token_encrypted'")
    .first<{ value: string }>();

  if (!tokenRow?.value) {
    throw new Error('Gmail is not connected: refresh token missing in settings');
  }

  const encryptionKey = env.TOKEN_ENCRYPTION_KEY || 'default_local_dev_secret_key_32_bytes!';
  const refreshToken = await decryptToken(tokenRow.value, encryptionKey);

  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // In local dev without credentials, return mock token
    if (env.ENVIRONMENT === 'development') {
      return 'mock_dev_access_token';
    }
    throw new Error('GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET not configured');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to refresh Gmail access token: ${resp.status} ${errText}`);
  }

  const data = (await resp.json()) as GmailTokenResponse;
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Send an email via the Gmail upload endpoint (/upload/gmail/v1/users/me/messages/send?uploadType=media)
 * Accepts raw RFC 822 MIME message directly without second base64url wrapping.
 */
export async function sendGmailMimeMessage(
  mimeMessage: string,
  env: WorkerEnv,
  dryRun = false
): Promise<GmailSendResponse> {
  if (dryRun) {
    console.log('[Gmail Send] DRY RUN mode active: simulated send');
    return {
      id: `dry_run_msg_${Date.now()}`,
      threadId: `dry_run_thread_${Date.now()}`,
    };
  }

  const accessToken = await getGmailAccessToken(env);

  const url = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'message/rfc822',
    },
    body: mimeMessage,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail API send failed: ${response.status} ${errText}`);
  }

  return (await response.json()) as GmailSendResponse;
}

/**
 * Check Gmail Sent folder for existing Message-ID to ensure idempotency.
 */
export async function searchSentByMessageId(
  messageId: string,
  env: WorkerEnv
): Promise<string | null> {
  try {
    const accessToken = await getGmailAccessToken(env);
    const q = `rfc822msgid:${messageId.replace(/[<>]/g, '')}`;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=1`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = (await res.json()) as { messages?: Array<{ id: string; threadId: string }> };
      if (data.messages && data.messages.length > 0) {
        return data.messages[0].id;
      }
    }
  } catch (err) {
    console.warn('Idempotency search error:', err);
  }
  return null;
}
