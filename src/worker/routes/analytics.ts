import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser } from '../../shared/types';
import { calendarDaysDiffMYT } from '../../shared/time';

const analyticsRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/analytics/overview - Comprehensive campaign metrics, pledge progress, and activity feed
analyticsRoute.get('/overview', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Sponsorship Goal & Pledge Calculations
  const pledgeTarget = 10140; // RM 10,140 target
  const pledgeStats = await db
    .prepare(`
      SELECT 
        COALESCE(SUM(pledge_amount), 0) as committed_total,
        COALESCE(SUM(pledge_received_amount), 0) as received_total,
        COUNT(CASE WHEN pledge_amount > 0 OR stage = 'committed' THEN 1 END) as committed_sponsors_count
      FROM sponsors
    `)
    .first<{ committed_total: number; received_total: number; committed_sponsors_count: number }>();

  const committedTotal = pledgeStats?.committed_total || 0;
  const receivedTotal = pledgeStats?.received_total || 0;
  const committedPercentage = Math.min(100, Math.round((committedTotal / pledgeTarget) * 100));
  const remainingTarget = Math.max(0, pledgeTarget - committedTotal);

  // Pledge Tiers Breakdown
  const tiersRes = await db
    .prepare(`
      SELECT pledge_tier, COUNT(*) as count, SUM(pledge_amount) as total
      FROM sponsors 
      WHERE pledge_amount > 0 AND pledge_tier IS NOT NULL
      GROUP BY pledge_tier
    `)
    .all<{ pledge_tier: string; count: number; total: number }>();

  // 2. High-level Funnel Metrics
  const funnelStats = await db
    .prepare(`
      SELECT 
        (SELECT COUNT(*) FROM sponsors) as total_sponsors,
        (SELECT COUNT(*) FROM sponsors WHERE email_status = 'valid') as valid_email_count,
        (SELECT COUNT(*) FROM sponsors WHERE email_status = 'no_email') as no_email_count,
        (SELECT COUNT(*) FROM sponsors WHERE email_status IN ('bounced_hard', 'bounced_soft')) as bounced_email_count,
        (SELECT COUNT(*) FROM sponsors WHERE stage IN ('sent', 'opened', 'replied', 'committed', 'in_discussion')) as contacted_count,
        (SELECT COUNT(*) FROM outreaches WHERE status = 'sent') as total_emails_sent,
        (SELECT COUNT(DISTINCT sponsor_id) FROM open_events WHERE classification = 'likely_human') as unique_opened_sponsors,
        (SELECT COUNT(*) FROM open_events WHERE classification = 'likely_human') as total_human_opens,
        (SELECT COUNT(DISTINCT sponsor_id) FROM replies_bounces WHERE type = 'reply') as unique_replied_sponsors,
        (SELECT COUNT(*) FROM calls) as total_calls_logged
    `)
    .first<any>();

  const totalSponsors = funnelStats?.total_sponsors || 485;
  const contactedCount = funnelStats?.contacted_count || 0;
  const openedCount = funnelStats?.unique_opened_sponsors || 0;
  const repliedCount = funnelStats?.unique_replied_sponsors || 0;

  const openRate = contactedCount > 0 ? Math.round((openedCount / contactedCount) * 100) : 0;
  const replyRate = contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 100) : 0;

  // 3. Hot Leads & Follow-ups Due
  const candidateRows = await db
    .prepare(`
      SELECT 
        s.id, s.stage, s.email_status, s.do_not_contact,
        (SELECT COUNT(*) FROM open_events o JOIN outreaches ot ON o.outreach_id = ot.id 
         WHERE ot.sponsor_id = s.id AND o.classification = 'likely_human' AND o.created_at >= ?) as opens_24h,
        (SELECT sent_at FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent' ORDER BY ot.sent_at DESC LIMIT 1) as last_email_date,
        (SELECT COUNT(*) FROM outreaches ot WHERE ot.sponsor_id = s.id AND ot.status = 'sent') as sent_outreach_count,
        (SELECT COUNT(*) FROM replies_bounces rb WHERE rb.sponsor_id = s.id AND rb.type = 'reply') as real_reply_count
      FROM sponsors s
      WHERE s.do_not_contact = 0 AND s.stage NOT IN ('declined', 'do_not_contact')
    `)
    .bind(twentyFourHoursAgo)
    .all<any>();

  let hotLeadsCount = 0;
  let followupsDueCount = 0;

  for (const row of candidateRows.results || []) {
    if (row.opens_24h >= 2 && row.real_reply_count === 0 && row.stage !== 'committed') {
      hotLeadsCount++;
    }

    if (
      (row.stage === 'sent' || row.stage === 'opened') &&
      row.real_reply_count === 0 &&
      row.last_email_date &&
      row.email_status !== 'bounced_hard' &&
      row.email_status !== 'bounced_soft'
    ) {
      const days = calendarDaysDiffMYT(new Date(row.last_email_date), now);
      if (days >= 7 && row.sent_outreach_count <= 3) {
        followupsDueCount++;
      }
    }
  }

  // 4. Latest Activity Feed (15 latest entries)
  const activityRows = await db
    .prepare(`
      SELECT 
        act.*,
        s.company_name,
        s.ref_no
      FROM activity_logs act
      LEFT JOIN sponsors s ON act.sponsor_id = s.id
      ORDER BY act.created_at DESC 
      LIMIT 15
    `)
    .all<any>();

  return c.json({
    kpis: {
      totalSponsors,
      validEmailCount: funnelStats?.valid_email_count || 0,
      noEmailCount: funnelStats?.no_email_count || 0,
      contactedCount,
      totalEmailsSent: funnelStats?.total_emails_sent || 0,
      openedCount,
      openRate,
      repliedCount,
      replyRate,
      bouncedCount: funnelStats?.bounced_email_count || 0,
      callsLogged: funnelStats?.total_calls_logged || 0,
      hotLeadsCount,
      followupsDueCount,
    },
    pledge: {
      targetAmount: pledgeTarget,
      committedAmount: committedTotal,
      receivedAmount: receivedTotal,
      percentage: committedPercentage,
      remainingAmount: remainingTarget,
      sponsorsCount: pledgeStats?.committed_sponsors_count || 0,
      tiers: tiersRes.results || [],
    },
    activities: activityRows.results || [],
  });
});

export default analyticsRoute;
