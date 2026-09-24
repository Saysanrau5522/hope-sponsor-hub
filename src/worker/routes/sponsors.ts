import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { cleanDisplayName, cleanEmailAddress, classifyContactQuality } from '../../shared/csv';
import { calendarDaysDiffMYT } from '../../shared/time';

const sponsorsRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/sponsors - Main sponsor table with search, filters, sorting
sponsorsRoute.get('/', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);

  const q = url.searchParams.get('q')?.trim() || '';
  const stage = url.searchParams.get('stage') || '';
  const emailStatus = url.searchParams.get('email_status') || '';
  const contactQuality = url.searchParams.get('contact_quality') || '';
  const owner = url.searchParams.get('owner') || '';
  const badge = url.searchParams.get('badge') || '';
  const sortBy = url.searchParams.get('sort') || 'seq';
  const sortDir = url.searchParams.get('dir')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM open_events o JOIN outreaches ot ON o.outreach_id = ot.id WHERE ot.sponsor_id = s.id AND o.classification = 'likely_human') as likely_human_opens,
      (SELECT COUNT(*) FROM open_events o JOIN outreaches ot ON o.outreach_id = ot.id WHERE ot.sponsor_id = s.id) as raw_opens,
      (SELECT sent_at FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent' ORDER BY ot.sent_at DESC LIMIT 1) as last_email_date,
      (SELECT snippet FROM replies_bounces rb WHERE rb.sponsor_id = s.id AND rb.type = 'reply' ORDER BY rb.received_at DESC LIMIT 1) as last_reply_snippet,
      (SELECT COUNT(*) FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent') as sent_outreach_count,
      (SELECT COUNT(*) FROM replies_bounces rb WHERE rb.sponsor_id = s.id AND rb.type = 'reply') as real_reply_count
    FROM sponsors s
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND (s.company_name LIKE ? OR s.display_name LIKE ? OR s.primary_email LIKE ? OR s.ref_no LIKE ? OR s.phone LIKE ?)`;
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (stage) {
    query += ` AND s.stage = ?`;
    params.push(stage);
  }

  if (emailStatus) {
    query += ` AND s.email_status = ?`;
    params.push(emailStatus);
  }

  if (contactQuality) {
    query += ` AND s.contact_quality = ?`;
    params.push(contactQuality);
  }

  if (owner) {
    query += ` AND s.owner = ?`;
    params.push(owner);
  }

  // Count total matching records before pagination
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const countStmt = db.prepare(countQuery).bind(...params);
  const countRes = await countStmt.first<{ total: number }>();
  const total = countRes?.total || 0;

  // Sorting
  const allowedSortCols = ['seq', 'company_name', 'stage', 'email_status', 'contact_quality', 'ref_no'];
  const orderCol = allowedSortCols.includes(sortBy) ? `s.${sortBy}` : 's.seq';
  query += ` ORDER BY ${orderCol} ${sortDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rowsRes = await db.prepare(query).bind(...params).all<any>();
  const now = new Date();

  // Compute derived badges (Needs Follow-up, Hot Lead)
  const sponsors = (rowsRes.results || []).map((row) => {
    const likelyOpens = row.likely_human_opens || 0;
    const realReplies = row.real_reply_count || 0;
    const sentCount = row.sent_outreach_count || 0;
    const lastEmailDateStr = row.last_email_date;

    let needs_followup = false;
    let followup_day = 0;
    let is_hot_lead = false;

    // Follow-up condition:
    // status is sent or opened, no real reply, last email was 7+ calendar days ago in MYT, not bounced/invalid/declined/dnc
    if (
      (row.stage === 'sent' || row.stage === 'opened') &&
      realReplies === 0 &&
      lastEmailDateStr &&
      row.do_not_contact === 0 &&
      row.email_status !== 'bounced_hard' &&
      row.email_status !== 'bounced_soft' &&
      row.email_status !== 'invalid_format'
    ) {
      const daysSinceSent = calendarDaysDiffMYT(new Date(lastEmailDateStr), now);
      if (daysSinceSent >= 7 && sentCount <= 3) {
        needs_followup = true;
        followup_day = daysSinceSent;
      }
    }

    // Hot lead: at least 2 likely-human opens within 24h, no reply, not bounced, not dnc
    if (
      likelyOpens >= 2 &&
      realReplies === 0 &&
      row.do_not_contact === 0 &&
      row.stage !== 'declined' &&
      row.email_status !== 'bounced_hard'
    ) {
      is_hot_lead = true;
    }

    return {
      ...row,
      needs_followup,
      followup_day,
      followup_count: sentCount > 0 ? sentCount - 1 : 0,
      is_hot_lead,
    };
  });

  return c.json({
    sponsors,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/sponsors/:id - Single sponsor detail with complete history
sponsorsRoute.get('/:id', async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'), 10);

  const sponsor = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first<Sponsor>();
  if (!sponsor) {
    return c.json({ error: 'Sponsor not found' }, 404);
  }

  // Get outreaches
  const outreaches = await db
    .prepare('SELECT * FROM outreaches WHERE sponsor_id = ? ORDER BY created_at DESC')
    .bind(id)
    .all();

  // Get opens
  const opens = await db
    .prepare('SELECT * FROM open_events WHERE sponsor_id = ? ORDER BY created_at DESC')
    .bind(id)
    .all();

  // Get replies/bounces
  const replies = await db
    .prepare('SELECT * FROM replies_bounces WHERE sponsor_id = ? ORDER BY received_at DESC')
    .bind(id)
    .all();

  // Get call logs
  const calls = await db
    .prepare('SELECT * FROM calls WHERE sponsor_id = ? ORDER BY created_at DESC')
    .bind(id)
    .all();

  // Get activity logs
  const activities = await db
    .prepare('SELECT * FROM activity_logs WHERE sponsor_id = ? ORDER BY created_at DESC')
    .bind(id)
    .all();

  return c.json({
    sponsor,
    history: {
      outreaches: outreaches.results,
      opens: opens.results,
      replies: replies.results,
      calls: calls.results,
      activities: activities.results,
    },
  });
});

// PATCH /api/sponsors/:id - Update sponsor details
sponsorsRoute.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();

  const existing = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first<Sponsor>();
  if (!existing) {
    return c.json({ error: 'Sponsor not found' }, 404);
  }

  const updates: string[] = [];
  const params: any[] = [];
  const logChanges: string[] = [];

  if (body.display_name !== undefined) {
    const cleanName = cleanDisplayName(body.display_name);
    updates.push('display_name = ?');
    params.push(cleanName);
    logChanges.push(`display_name changed to '${cleanName}'`);
  }

  if (body.primary_email !== undefined) {
    const cleanEmail = cleanEmailAddress(body.primary_email);
    updates.push('primary_email = ?');
    params.push(cleanEmail);
    logChanges.push(`email changed to '${cleanEmail}'`);
  }

  if (body.notes !== undefined) {
    updates.push('notes = ?');
    params.push(body.notes);
    logChanges.push(`notes updated`);
  }

  if (body.owner !== undefined) {
    updates.push('owner = ?');
    params.push(body.owner);
    logChanges.push(`owner assigned to ${body.owner}`);
  }

  if (body.stage !== undefined) {
    updates.push('stage = ?');
    params.push(body.stage);
    logChanges.push(`stage changed to ${body.stage}`);
  }

  if (body.do_not_contact !== undefined) {
    const dnc = body.do_not_contact ? 1 : 0;
    updates.push('do_not_contact = ?');
    params.push(dnc);
    if (dnc) updates.push("stage = 'do_not_contact'");
    logChanges.push(`do_not_contact set to ${dnc}`);
  }

  if (body.already_contacted_date !== undefined) {
    updates.push('already_contacted_date = ?');
    params.push(body.already_contacted_date);
    logChanges.push(`marked already contacted on ${body.already_contacted_date}`);
  }

  if (body.pledge_tier !== undefined) {
    updates.push('pledge_tier = ?');
    params.push(body.pledge_tier);
  }

  if (body.pledge_amount !== undefined) {
    updates.push('pledge_amount = ?');
    params.push(body.pledge_amount);
  }

  if (body.in_kind_description !== undefined) {
    updates.push('in_kind_description = ?');
    params.push(body.in_kind_description);
  }

  if (body.pledge_received_amount !== undefined) {
    updates.push('pledge_received_amount = ?');
    params.push(body.pledge_received_amount);
  }

  if (updates.length === 0) {
    return c.json({ sponsor: existing });
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  const query = `UPDATE sponsors SET ${updates.join(', ')} WHERE id = ?`;
  await db.prepare(query).bind(...params).run();

  // Log activity
  if (logChanges.length > 0) {
    await db
      .prepare('INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, user.email, 'update_sponsor', logChanges.join('; '), now)
      .run();
  }

  const updated = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first<Sponsor>();
  return c.json({ sponsor: updated });
});

// POST /api/sponsors/bulk - Bulk actions
sponsorsRoute.post('/bulk', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{
    action: 'approve_to_queue' | 'assign_owner' | 'mark_already_contacted' | 'set_do_not_contact';
    sponsor_ids: number[];
    owner?: string;
    contacted_date?: string;
  }>();

  const { action, sponsor_ids } = body;
  if (!sponsor_ids || sponsor_ids.length === 0) {
    return c.json({ error: 'No sponsor IDs provided' }, 400);
  }

  const now = new Date().toISOString();
  const placeholders = sponsor_ids.map(() => '?').join(',');

  if (action === 'approve_to_queue') {
    // Only not_contacted sponsors with valid email and do_not_contact = 0 can be queued
    await db
      .prepare(`UPDATE sponsors SET stage = 'queued', updated_at = ? WHERE id IN (${placeholders}) AND email_status = 'valid' AND do_not_contact = 0 AND stage = 'not_contacted'`)
      .bind(now, ...sponsor_ids)
      .run();
  } else if (action === 'assign_owner' && body.owner) {
    await db
      .prepare(`UPDATE sponsors SET owner = ?, updated_at = ? WHERE id IN (${placeholders})`)
      .bind(body.owner, now, ...sponsor_ids)
      .run();
  } else if (action === 'mark_already_contacted') {
    const contactDate = body.contacted_date || now;
    await db
      .prepare(`UPDATE sponsors SET already_contacted_date = ?, stage = 'sent', updated_at = ? WHERE id IN (${placeholders})`)
      .bind(contactDate, now, ...sponsor_ids)
      .run();
  } else if (action === 'set_do_not_contact') {
    await db
      .prepare(`UPDATE sponsors SET do_not_contact = 1, stage = 'do_not_contact', updated_at = ? WHERE id IN (${placeholders})`)
      .bind(now, ...sponsor_ids)
      .run();
  }

  return c.json({ success: true, count: sponsor_ids.length });
});

export default sponsorsRoute;
