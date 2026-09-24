import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import {
  getBatchReviewSummary,
  approveBatch,
  getDailyQuotaStats,
  processQueueTick,
} from '../services/queue';

const queueRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/queue/review - Get review summary before approving batch
queueRoute.get('/review', async (c) => {
  const summary = await getBatchReviewSummary(c.env);
  return c.json(summary);
});

// GET /api/queue/pilot-candidates - Eligible sponsors for pilot of 5 selection
queueRoute.get('/pilot-candidates', async (c) => {
  const db = c.env.DB;
  const res = await db
    .prepare(`
      SELECT id, seq, ref_no, company_name, display_name, primary_email, type, contact_quality
      FROM sponsors
      WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0
      ORDER BY seq ASC
      LIMIT 25
    `)
    .all<Sponsor>();

  return c.json({ candidates: res.results || [] });
});

// POST /api/queue/approve-batch - Human batch approval
queueRoute.post('/approve-batch', async (c) => {
  const user = c.get('user');
  const body = (await c.req.json().catch(() => ({}))) as { sponsor_ids?: number[] };
  const res = await approveBatch(c.env, user.email, body.sponsor_ids);
  return c.json({ success: true, count: res.count });
});

// GET /api/queue/stats - Pacing, quota and queue metrics
queueRoute.get('/stats', async (c) => {
  const db = c.env.DB;
  const quota = await getDailyQuotaStats(c.env);

  const statusCounts = await db
    .prepare(`
      SELECT 
        SUM(CASE WHEN stage = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN stage = 'sending' THEN 1 ELSE 0 END) as sending,
        SUM(CASE WHEN stage = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN stage = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sponsors
    `)
    .first<any>();

  const nextDueItem = await db
    .prepare("SELECT next_due_at FROM outreaches WHERE status = 'queued' ORDER BY id ASC LIMIT 1")
    .first<{ next_due_at: string }>();

  return c.json({
    quota,
    counts: {
      queued: statusCounts?.queued || 0,
      sending: statusCounts?.sending || 0,
      sent: statusCounts?.sent || 0,
      failed: statusCounts?.failed || 0,
    },
    nextDueAt: nextDueItem?.next_due_at || null,
  });
});

// POST /api/queue/tick - Run a queue tick (manual trigger or testing)
queueRoute.post('/tick', async (c) => {
  const url = new URL(c.req.url);
  const force = url.searchParams.get('force') === 'true';
  const res = await processQueueTick(c.env, new Date(), force);
  return c.json(res);
});

// POST /api/queue/controls - Update global pause/resume and dry_run
queueRoute.post('/controls', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ send_enabled?: boolean; dry_run?: boolean }>();
  const now = new Date().toISOString();

  if (body.send_enabled !== undefined) {
    const val = body.send_enabled ? 'true' : 'false';
    await db
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('send_enabled', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(val, now)
      .run();
    await db
      .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
      .bind(user.email, 'toggle_send_enabled', `Set send_enabled to ${val}`, now)
      .run();
  }

  if (body.dry_run !== undefined) {
    const val = body.dry_run ? 'true' : 'false';
    await db
      .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('dry_run', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(val, now)
      .run();
    await db
      .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
      .bind(user.email, 'toggle_dry_run', `Set dry_run to ${val}`, now)
      .run();
  }

  return c.json({ success: true });
});

export default queueRoute;
