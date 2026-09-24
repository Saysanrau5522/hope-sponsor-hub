import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { cleanEmailAddress } from '../../shared/csv';
import { checkDomainDNS, isValidEmailSyntax } from '../../shared/validation';

const problemsRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/problems - Grouped counts and items for problems
problemsRoute.get('/', async (c) => {
  const db = c.env.DB;

  // 1. Group counts
  const countsRes = await db
    .prepare(`
      SELECT 
        SUM(CASE WHEN email_status = 'no_email' THEN 1 ELSE 0 END) as count_no_email,
        SUM(CASE WHEN email_status = 'invalid_format' THEN 1 ELSE 0 END) as count_invalid_format,
        SUM(CASE WHEN email_status = 'no_mx' THEN 1 ELSE 0 END) as count_no_mx,
        SUM(CASE WHEN email_status IN ('bounced_hard', 'bounced_soft') THEN 1 ELSE 0 END) as count_bounced,
        SUM(CASE WHEN email_status = 'shared_inbox' THEN 1 ELSE 0 END) as count_shared_inbox,
        SUM(CASE WHEN email_status = 'suspicious_domain' OR flags LIKE '%freemail%' THEN 1 ELSE 0 END) as count_suspicious_or_freemail,
        (SELECT COUNT(DISTINCT sponsor_id) FROM outreaches WHERE status = 'failed') as count_send_failures
      FROM sponsors
    `)
    .first<any>();

  const activeTab = c.req.query('tab') || 'no_email';
  let query = 'SELECT * FROM sponsors WHERE ';

  if (activeTab === 'no_email') {
    query += "email_status = 'no_email' ORDER BY seq ASC";
  } else if (activeTab === 'invalid_format') {
    query += "email_status = 'invalid_format' ORDER BY seq ASC";
  } else if (activeTab === 'no_mx') {
    query += "email_status = 'no_mx' ORDER BY seq ASC";
  } else if (activeTab === 'bounced') {
    query += "email_status IN ('bounced_hard', 'bounced_soft') ORDER BY seq ASC";
  } else if (activeTab === 'shared_inbox') {
    query += "email_status = 'shared_inbox' ORDER BY primary_email ASC, seq ASC";
  } else if (activeTab === 'suspicious_or_freemail') {
    query += "(email_status = 'suspicious_domain' OR flags LIKE '%freemail%') ORDER BY seq ASC";
  } else if (activeTab === 'send_failures') {
    query = `
      SELECT s.*, o.failed_reason, o.created_at as failed_at 
      FROM sponsors s 
      JOIN outreaches o ON s.id = o.sponsor_id 
      WHERE o.status = 'failed' 
      ORDER BY o.created_at DESC
    `;
  } else {
    query += "email_status = 'no_email' ORDER BY seq ASC";
  }

  const items = await db.prepare(query).all<Sponsor>();

  return c.json({
    counts: {
      no_email: countsRes?.count_no_email || 0,
      invalid_format: countsRes?.count_invalid_format || 0,
      no_mx: countsRes?.count_no_mx || 0,
      bounced: countsRes?.count_bounced || 0,
      shared_inbox: countsRes?.count_shared_inbox || 0,
      suspicious_or_freemail: countsRes?.count_suspicious_or_freemail || 0,
      send_failures: countsRes?.count_send_failures || 0,
    },
    activeTab,
    items: items.results || [],
  });
});

// POST /api/problems/fix-email - Inline fix email and re-queue
problemsRoute.post('/fix-email', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{
    sponsor_id: number;
    new_email: string;
    queue_now?: boolean;
  }>();

  const { sponsor_id, new_email, queue_now = true } = body;
  const cleaned = cleanEmailAddress(new_email);

  if (!cleaned || !isValidEmailSyntax(cleaned)) {
    return c.json({ error: 'Invalid email address syntax' }, 400);
  }

  // Validate DoH
  const domain = cleaned.split('@')[1];
  const dnsRes = await checkDomainDNS(domain);

  const now = new Date().toISOString();
  const newStatus = dnsRes.status;
  const nextStage = queue_now && newStatus === 'valid' ? 'queued' : 'not_contacted';

  await db
    .prepare(`
      UPDATE sponsors 
      SET 
        primary_email = ?,
        email_status = ?,
        stage = ?,
        validated_at = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(cleaned, newStatus, nextStage, now, now, sponsor_id)
    .run();

  await db
    .prepare(`
      INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      sponsor_id,
      user.email,
      'fix_email',
      `Updated email to ${cleaned} (status: ${newStatus}, stage: ${nextStage})`,
      now
    )
    .run();

  const updated = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(sponsor_id).first<Sponsor>();

  return c.json({
    success: true,
    sponsor: updated,
    dns: dnsRes,
  });
});

export default problemsRoute;
