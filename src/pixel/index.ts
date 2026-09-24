import { OpenClassification } from '../shared/types';

// 1x1 transparent GIF 43 bytes binary
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export interface PixelEnv {
  DB: D1Database;
  ENVIRONMENT?: string;
}

export function classifyOpenHit(
  sentAtISO: string | null,
  nowISO: string,
  asn: number | null,
  previousHitInSameSecond: boolean,
  previousLikelyHumanIn5Min: boolean
): OpenClassification {
  if (sentAtISO) {
    const sentTime = new Date(sentAtISO).getTime();
    const hitTime = new Date(nowISO).getTime();
    const diffSec = (hitTime - sentTime) / 1000;
    // Ignored early: within 2 minutes (120 seconds) of sending
    if (diffSec < 120) {
      return 'ignored_early';
    }
  }

  // Apple Mail Privacy Protection ASN 714 or hit in exact same second
  if (asn === 714 || previousHitInSameSecond) {
    return 'possible_prefetch';
  }

  // De-duplicate within 5-minute window: still counted as likely_human, but downstream metrics can group them
  return 'likely_human';
}

export default {
  async fetch(request: Request, env: PixelEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Fast response header for 1x1 transparent GIF
    const gifResponse = new Response(TRANSPARENT_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    // Match /t/<token>.gif
    const match = path.match(/^\/t\/([a-zA-Z0-9_-]+)\.gif$/);
    if (!match) {
      return gifResponse;
    }

    const token = match[1];
    const userAgent = request.headers.get('user-agent') || null;
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
    const cf = (request as any).cf || {};
    const country = cf.country || null;
    const asn = cf.asn ? parseInt(cf.asn, 10) : null;
    const nowISO = new Date().toISOString();

    // Perform database logging in background without delaying image response
    ctx.waitUntil(
      (async () => {
        try {
          // Look up outreach by token
          const outreach = await env.DB.prepare(
            'SELECT id, sponsor_id, sent_at FROM outreaches WHERE tracking_token = ?'
          )
            .bind(token)
            .first<{ id: number; sponsor_id: number; sent_at: string }>();

          let classification: OpenClassification = 'likely_human';

          if (outreach) {
            // Check for hits in same second or recent likely_human
            const recentHits = await env.DB.prepare(
              'SELECT created_at, classification FROM open_events WHERE outreach_id = ? ORDER BY created_at DESC LIMIT 5'
            )
              .bind(outreach.id)
              .all<{ created_at: string; classification: string }>();

            const hits = recentHits.results || [];
            const previousHitInSameSecond = hits.some(
              (h) => Math.abs(new Date(h.created_at).getTime() - new Date(nowISO).getTime()) < 1000
            );
            const previousLikelyHumanIn5Min = hits.some(
              (h) =>
                h.classification === 'likely_human' &&
                new Date(nowISO).getTime() - new Date(h.created_at).getTime() < 5 * 60 * 1000
            );

            classification = classifyOpenHit(
              outreach.sent_at,
              nowISO,
              asn,
              previousHitInSameSecond,
              previousLikelyHumanIn5Min
            );

            // Insert open event
            await env.DB.prepare(`
              INSERT INTO open_events (tracking_token, sponsor_id, outreach_id, ip, user_agent, country, asn, classification, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
              .bind(token, outreach.sponsor_id, outreach.id, ip, userAgent, country, asn, classification, nowISO)
              .run();

            // If likely_human, transition sponsor stage to 'opened' if currently 'sent'
            if (classification === 'likely_human') {
              await env.DB.prepare(`
                UPDATE sponsors 
                SET stage = 'opened', updated_at = ? 
                WHERE id = ? AND stage = 'sent'
              `)
                .bind(nowISO, outreach.sponsor_id)
                .run();
            }
          } else {
            // Log unknown token event gracefully
            await env.DB.prepare(`
              INSERT INTO open_events (tracking_token, ip, user_agent, country, asn, classification, created_at)
              VALUES (?, ?, ?, ?, ?, 'possible_prefetch', ?)
            `)
              .bind(token, ip, userAgent, country, asn, nowISO)
              .run();
          }
        } catch (err) {
          console.error('Error logging pixel open event:', err);
        }
      })()
    );

    return gifResponse;
  },
};
