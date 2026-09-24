import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser } from '../../shared/types';
import { pollInboxTick } from '../services/inbox';
import { buildGmailDeepLink } from '../../shared/replies';

const repliesRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/replies - List all replies, auto-replies, and bounces
repliesRoute.get('/', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);

  const type = url.searchParams.get('type') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      rb.*,
      s.seq as sponsor_seq,
      s.ref_no as sponsor_ref_no,
      s.company_name,
      s.display_name,
      s.primary_email as sponsor_email,
      s.phone as sponsor_phone,
      s.stage as sponsor_stage,
      ot.subject as outreach_subject
    FROM replies_bounces rb
    LEFT JOIN sponsors s ON rb.sponsor_id = s.id
    LEFT JOIN outreaches ot ON rb.outreach_id = ot.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type && type !== 'all') {
    query += ` AND rb.type = ?`;
    params.push(type);
  }

  // Count total matching
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const countStmt = db.prepare(countQuery).bind(...params);
  const countRes = await countStmt.first<{ total: number }>();
  const total = countRes?.total || 0;

  // Sorting: newest received first
  query += ` ORDER BY rb.received_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = await db.prepare(query).bind(...params).all<any>();

  // Overall counts for summary pills
  const statsRes = await db
    .prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'reply' THEN 1 ELSE 0 END) as replies,
        SUM(CASE WHEN type = 'auto_reply' THEN 1 ELSE 0 END) as auto_replies,
        SUM(CASE WHEN type IN ('bounce_hard', 'bounce_soft') THEN 1 ELSE 0 END) as bounces
      FROM replies_bounces
    `)
    .first<{ total: number; replies: number; auto_replies: number; bounces: number }>();

  const items = (rows.results || []).map((row) => ({
    ...row,
    gmail_deep_link: buildGmailDeepLink(row.gmail_message_id, row.gmail_thread_id),
  }));

  return c.json({
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      total: statsRes?.total || 0,
      replies: statsRes?.replies || 0,
      autoReplies: statsRes?.auto_replies || 0,
      bounces: statsRes?.bounces || 0,
    },
  });
});

// POST /api/replies/poll - Manually trigger inbox check
repliesRoute.post('/poll', async (c) => {
  const result = await pollInboxTick(c.env);
  return c.json(result);
});

// PATCH /api/replies/:id - Update reply classification/outcome
repliesRoute.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    outcome?: 'interested' | 'need_more_info' | 'declined' | 'committed';
    notes?: string;
  }>();

  const existing = await db
    .prepare('SELECT * FROM replies_bounces WHERE id = ?')
    .bind(id)
    .first<any>();

  if (!existing) {
    return c.json({ error: 'Reply not found' }, 404);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (body.outcome !== undefined) {
    updates.push('outcome = ?');
    params.push(body.outcome);
  }

  if (updates.length > 0) {
    params.push(id);
    await db
      .prepare(`UPDATE replies_bounces SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // Sync to sponsor stage if outcome changed
    if (body.outcome && existing.sponsor_id) {
      let newStage: string | null = null;
      if (body.outcome === 'committed') newStage = 'committed';
      else if (body.outcome === 'declined') newStage = 'declined';
      else if (body.outcome === 'interested' || body.outcome === 'need_more_info') newStage = 'in_discussion';

      if (newStage) {
        const now = new Date().toISOString();
        await db
          .prepare('UPDATE sponsors SET stage = ?, updated_at = ? WHERE id = ?')
          .bind(newStage, now, existing.sponsor_id)
          .run();

        await db
          .prepare(
            'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(existing.sponsor_id, user.email, 'update_reply_outcome', `Outcome set to ${body.outcome} (stage: ${newStage})`, now)
          .run();
      }
    }
  }

  const updated = await db.prepare('SELECT * FROM replies_bounces WHERE id = ?').bind(id).first();
  return c.json({ reply: updated });
});

export default repliesRoute;
