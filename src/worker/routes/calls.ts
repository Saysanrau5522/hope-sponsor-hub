import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { calendarDaysDiffMYT } from '../../shared/time';

const callsRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/calls - List logged calls
callsRoute.get('/', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const sponsorId = url.searchParams.get('sponsor_id');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      cl.*,
      s.seq as sponsor_seq,
      s.ref_no as sponsor_ref_no,
      s.company_name,
      s.display_name,
      s.phone as sponsor_phone,
      s.stage as sponsor_stage
    FROM calls cl
    JOIN sponsors s ON cl.sponsor_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (sponsorId) {
    query += ` AND cl.sponsor_id = ?`;
    params.push(parseInt(sponsorId, 10));
  }

  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const countRes = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countRes?.total || 0;

  query += ` ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = await db.prepare(query).bind(...params).all<any>();

  return c.json({
    calls: rows.results || [],
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// POST /api/calls - Log a new call
callsRoute.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{
    sponsor_id: number;
    caller: string;
    outcome: string;
    notes?: string;
    callback_date?: string;
    pledge_tier?: string;
    pledge_amount?: number;
    in_kind_description?: string;
    stage_update?: string;
  }>();

  if (!body.sponsor_id || !body.caller || !body.outcome) {
    return c.json({ error: 'sponsor_id, caller, and outcome are required' }, 400);
  }

  const sponsor = await db
    .prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(body.sponsor_id)
    .first<Sponsor>();

  if (!sponsor) {
    return c.json({ error: 'Sponsor not found' }, 404);
  }

  const now = new Date().toISOString();

  // 1. Insert into calls table
  const insertCallRes = await db
    .prepare(
      'INSERT INTO calls (sponsor_id, caller, outcome, notes, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(body.sponsor_id, body.caller, body.outcome, body.notes || null, now)
    .run();

  const callId = insertCallRes.meta?.last_row_id;

  // 2. Update sponsor based on outcome & pledge
  const sponsorUpdates: string[] = ['updated_at = ?'];
  const sponsorParams: any[] = [now];
  const activityDetails: string[] = [`Call logged by ${body.caller}: ${body.outcome}`];

  if (body.pledge_amount && body.pledge_amount > 0) {
    sponsorUpdates.push('pledge_amount = ?');
    sponsorParams.push(body.pledge_amount);
    sponsorUpdates.push("stage = 'committed'");
    activityDetails.push(`Pledged RM ${body.pledge_amount}`);
  }

  if (body.pledge_tier) {
    sponsorUpdates.push('pledge_tier = ?');
    sponsorParams.push(body.pledge_tier);
  }

  if (body.in_kind_description) {
    sponsorUpdates.push('in_kind_description = ?');
    sponsorParams.push(body.in_kind_description);
    activityDetails.push(`In-kind: ${body.in_kind_description}`);
  }

  if (body.stage_update) {
    sponsorUpdates.push('stage = ?');
    sponsorParams.push(body.stage_update);
    activityDetails.push(`Stage updated to ${body.stage_update}`);
  } else if (body.outcome === 'reached_declined') {
    sponsorUpdates.push("stage = 'declined'");
    activityDetails.push('Stage updated to declined');
  } else if (body.outcome === 'reached_interested' && sponsor.stage !== 'committed') {
    sponsorUpdates.push("stage = 'in_discussion'");
    activityDetails.push('Stage updated to in_discussion');
  }

  if (body.notes) {
    const existingNotes = sponsor.notes ? `${sponsor.notes}\n` : '';
    const newNotes = `${existingNotes}[Call ${now.slice(0, 10)} - ${body.caller}]: ${body.notes}`;
    sponsorUpdates.push('notes = ?');
    sponsorParams.push(newNotes);
  }

  sponsorParams.push(body.sponsor_id);
  await db
    .prepare(`UPDATE sponsors SET ${sponsorUpdates.join(', ')} WHERE id = ?`)
    .bind(...sponsorParams)
    .run();

  // 3. Log to activity_logs
  await db
    .prepare(
      'INSERT INTO activity_logs (sponsor_id, actor_email, action, details, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(body.sponsor_id, user.email, 'log_call', activityDetails.join(' | '), now)
    .run();

  const updatedSponsor = await db
    .prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(body.sponsor_id)
    .first<Sponsor>();

  return c.json({
    success: true,
    callId,
    sponsor: updatedSponsor,
  });
});

// GET /api/calls/queue - Prioritized calling list
callsRoute.get('/queue', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch candidate sponsors who might need calling:
  // 1. Hot leads (likely_human opens in last 24h >= 2, no reply, not DNC)
  // 2. Follow-ups overdue (sent or opened, last_sent >= 7 days ago in MYT, no reply, not bounced, not DNC)
  // 3. No email (email_status = 'no_email' and phone is present)
  // 4. Bounced email (email_status IN ('bounced_hard', 'bounced_soft') and phone is present)
  const query = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM open_events o JOIN outreaches ot ON o.outreach_id = ot.id 
       WHERE ot.sponsor_id = s.id AND o.classification = 'likely_human' AND o.created_at >= ?) as opens_24h,
      (SELECT COUNT(*) FROM open_events o JOIN outreaches ot ON o.outreach_id = ot.id 
       WHERE ot.sponsor_id = s.id AND o.classification = 'likely_human') as likely_human_opens,
      (SELECT sent_at FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent' ORDER BY ot.sent_at DESC LIMIT 1) as last_email_date,
      (SELECT COUNT(*) FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent') as sent_outreach_count,
      (SELECT COUNT(*) FROM replies_bounces rb WHERE rb.sponsor_id = s.id AND rb.type = 'reply') as real_reply_count,
      (SELECT outcome FROM calls cl WHERE cl.sponsor_id = s.id ORDER BY cl.created_at DESC LIMIT 1) as last_call_outcome,
      (SELECT created_at FROM calls cl WHERE cl.sponsor_id = s.id ORDER BY cl.created_at DESC LIMIT 1) as last_call_date
    FROM sponsors s
    WHERE s.do_not_contact = 0 
      AND s.stage NOT IN ('declined', 'do_not_contact')
      AND (s.phone IS NOT NULL AND TRIM(s.phone) != '')
    ORDER BY s.seq ASC
  `;

  const rows = await db.prepare(query).bind(twentyFourHoursAgo).all<any>();

  type CallCategory = 'hot_lead' | 'followup_due' | 'bounced_email' | 'no_email';

  interface CallQueueItem {
    sponsor: any;
    priority: number; // 1 = highest (hot lead), 2 = follow-up, 3 = bounced, 4 = no email
    category: CallCategory;
    reason: string;
    daysOverdue?: number;
    opens24h?: number;
  }

  const queueItems: CallQueueItem[] = [];

  for (const row of rows.results || []) {
    const opens24h = row.opens_24h || 0;
    const realReplies = row.real_reply_count || 0;
    const sentCount = row.sent_outreach_count || 0;
    const lastEmailDateStr = row.last_email_date;

    // Check Priority 1: Hot Lead (2+ opens in 24h, no reply)
    if (opens24h >= 2 && realReplies === 0 && row.stage !== 'committed') {
      queueItems.push({
        sponsor: row,
        priority: 1,
        category: 'hot_lead',
        reason: `Opened proposal ${opens24h} times in past 24 hours! Strike while warm.`,
        opens24h,
      });
      continue;
    }

    // Check Priority 2: Follow-up Due (7+ calendar days in MYT, sent <= 3, not replied, not bounced)
    if (
      (row.stage === 'sent' || row.stage === 'opened') &&
      realReplies === 0 &&
      lastEmailDateStr &&
      row.email_status !== 'bounced_hard' &&
      row.email_status !== 'bounced_soft'
    ) {
      const daysSinceSent = calendarDaysDiffMYT(new Date(lastEmailDateStr), now);
      if (daysSinceSent >= 7 && sentCount <= 3) {
        queueItems.push({
          sponsor: row,
          priority: 2,
          category: 'followup_due',
          reason: `Outreach sent ${daysSinceSent} days ago without reply. Call to check receipt.`,
          daysOverdue: daysSinceSent - 7,
        });
        continue;
      }
    }

    // Check Priority 3: Bounced Email with Phone
    if (row.email_status === 'bounced_hard' || row.email_status === 'bounced_soft') {
      queueItems.push({
        sponsor: row,
        priority: 3,
        category: 'bounced_email',
        reason: `Email bounced (${row.email_status}). Call to verify updated contact email.`,
      });
      continue;
    }

    // Check Priority 4: No Email available (phone-only outreach)
    if (row.email_status === 'no_email' && row.stage === 'not_contacted') {
      queueItems.push({
        sponsor: row,
        priority: 4,
        category: 'no_email',
        reason: 'No email address available. Direct phone contact required.',
      });
      continue;
    }
  }

  // Sort by priority (1 first, then 2, etc.)
  queueItems.sort((a, b) => a.priority - b.priority);

  const stats = {
    total: queueItems.length,
    hotLeads: queueItems.filter((q) => q.category === 'hot_lead').length,
    followupsDue: queueItems.filter((q) => q.category === 'followup_due').length,
    bounced: queueItems.filter((q) => q.category === 'bounced_email').length,
    noEmail: queueItems.filter((q) => q.category === 'no_email').length,
  };

  return c.json({
    items: queueItems,
    stats,
  });
});

export default callsRoute;
