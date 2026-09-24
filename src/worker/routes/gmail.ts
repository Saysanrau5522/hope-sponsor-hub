import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { encryptToken, generateTrackingToken } from '../../shared/crypto';
import { generateLetter, setCachedTemplate } from '../../shared/letter';
import { buildMimeMessage } from '../../shared/mime';
import { sendGmailMimeMessage } from '../services/gmail';
import { VERBATIM_EMAIL_SUBJECT } from '../../shared/constants';

const gmailRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/gmail/status - Check connection status
gmailRoute.get('/status', async (c) => {
  const db = c.env.DB;
  const tokenRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'gmail_refresh_token_encrypted'")
    .first<{ value: string }>();

  const isConnected = Boolean(tokenRow?.value);
  const senderEmailRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'sender_email'")
    .first<{ value: string }>();

  return c.json({
    connected: isConnected,
    account: senderEmailRow?.value || 'hopebyssi@gmail.com',
    clientIdConfigured: Boolean(c.env.GMAIL_CLIENT_ID),
  });
});

// GET /api/gmail/auth-url - OAuth consent redirect URL
gmailRoute.get('/auth-url', async (c) => {
  const clientId = c.env.GMAIL_CLIENT_ID;
  const redirectUri = c.env.GMAIL_REDIRECT_URI || `${new URL(c.req.url).origin}/api/gmail/callback`;

  if (!clientId) {
    return c.json({ error: 'GMAIL_CLIENT_ID not configured in worker environment' }, 400);
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  return c.json({ authUrl });
});

// GET /api/gmail/callback - OAuth exchange callback
gmailRoute.get('/callback', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error || !code) {
    return c.text(`Google OAuth failed or denied: ${error || 'no code provided'}`, 400);
  }

  const clientId = c.env.GMAIL_CLIENT_ID;
  const clientSecret = c.env.GMAIL_CLIENT_SECRET;
  const redirectUri = c.env.GMAIL_REDIRECT_URI || `${new URL(c.req.url).origin}/api/gmail/callback`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    return c.text(`OAuth token exchange error: ${errText}`, 400);
  }

  const data = (await tokenResp.json()) as { refresh_token?: string; access_token: string };
  if (!data.refresh_token) {
    return c.text('No refresh token returned. Ensure prompt=consent was passed.', 400);
  }

  // Encrypt refresh token with AES-GCM
  const secretKey = c.env.TOKEN_ENCRYPTION_KEY || 'default_local_dev_secret_key_32_bytes!';
  const encryptedRefreshToken = await encryptToken(data.refresh_token, secretKey);
  const now = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('gmail_refresh_token_encrypted', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(encryptedRefreshToken, now)
    .run();

  await db
    .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.email, 'connect_gmail', 'Connected Gmail account via OAuth', now)
    .run();

  return c.redirect('/?tab=send_center&gmail=connected');
});

// POST /api/gmail/send-test - Send test outreach to authenticated user
gmailRoute.post('/send-test', async (c) => {
  const db = c.env.DB;
  const env = c.env;
  const user = c.get('user');

  // Recipient is the authenticated team user
  const recipientEmail = user.email || 'hopebyssi@gmail.com';
  const fakeCompany = {
    company_name: 'TEST & CO. SDN BHD',
    display_name: 'TEST & CO. SDN BHD',
    ref_no: 'USM/SSI2627/HOPE/SLF/999',
    seq: 999,
  };

  // 1. Load proposal base64 from R2 (or fallback)
  let proposalBase64 = '';
  if (env.BUCKET) {
    const obj = await env.BUCKET.get('assets/proposal.base64');
    if (obj) {
      proposalBase64 = await obj.text();
    }
  }

  if (!proposalBase64) {
    // Generate minimal dummy base64 if bucket empty
    proposalBase64 = btoa('%PDF-1.4\n%Minimal Test PDF\n%%EOF');
  }

  // 2. Load template bytes and generate letter dated today in MYT
  let templateBytes: Uint8Array | null = null;
  if (env.BUCKET) {
    const obj = await env.BUCKET.get('assets/template.docx');
    if (obj) {
      templateBytes = new Uint8Array(await obj.arrayBuffer());
      setCachedTemplate(templateBytes);
    }
  }

  const { docxBytes, refNo, dateText } = generateLetter(fakeCompany, new Date(), templateBytes || undefined);

  // 3. Prepare tracking token and outreach record
  const trackingToken = generateTrackingToken();
  const outreachId = `test_${Date.now()}`;
  const rfc822MsgId = `<hope-${outreachId}@hope-sponsor-hub>`;

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
  const isDryRun = (env.DRY_RUN === 'true') || dryRunRow?.value === 'true';

  // 4. Build MIME message
  const mimeMessage = buildMimeMessage({
    fromName,
    fromEmail,
    toEmail: recipientEmail,
    companyName: fakeCompany.display_name,
    subject: VERBATIM_EMAIL_SUBJECT,
    outreachId,
    trackingToken,
    pixelHost: env.PIXEL_HOST || 'localhost:8788',
    proposalBase64,
    letterDocxBytes: docxBytes,
  });

  // 5. Send via Gmail upload endpoint (or dry-run simulated)
  const sendRes = await sendGmailMimeMessage(mimeMessage, env, isDryRun);
  const now = new Date().toISOString();

  // Log activity
  await db
    .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
    .bind(
      user.email,
      'send_test_email',
      `Sent test email to ${recipientEmail} (letter dated: ${dateText}, msgId: ${sendRes.id})`,
      now
    )
    .run();

  return c.json({
    success: true,
    recipient: recipientEmail,
    dateText,
    refNo,
    messageId: sendRes.id,
    threadId: sendRes.threadId,
    trackingToken,
    dryRun: isDryRun,
  });
});

export default gmailRoute;
