import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser } from '../../shared/types';
import { performDailyBackup } from '../services/backup';

const settingsRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/settings - Retrieve app settings and system status
settingsRoute.get('/', async (c) => {
  const db = c.env.DB;

  const rows = await db.prepare('SELECT key, value, updated_at FROM settings').all<any>();
  const settingsMap: Record<string, string> = {};
  for (const r of rows.results || []) {
    settingsMap[r.key] = r.value;
  }

  // Check Gmail connection
  const tokenRow = await db
    .prepare("SELECT value FROM settings WHERE key = 'gmail_refresh_token_encrypted'")
    .first<{ value: string }>();

  // Check R2 Backups
  let latestBackup: string | null = null;
  if (c.env.ASSETS_BUCKET) {
    try {
      const objects = await c.env.ASSETS_BUCKET.list({ prefix: 'backups/', limit: 5 });
      if (objects.objects.length > 0) {
        latestBackup = objects.objects[objects.objects.length - 1].key;
      }
    } catch (e) {
      console.warn('R2 backup listing error:', e);
    }
  }

  return c.json({
    settings: settingsMap,
    system: {
      gmailConnected: Boolean(tokenRow?.value),
      r2Bound: Boolean(c.env.ASSETS_BUCKET),
      latestBackup,
      timezone: 'Asia/Kuala_Lumpur (UTC+8)',
      environment: c.env.ENVIRONMENT || 'production',
      sendWindow: 'Mon - Fri, 09:00 - 16:30 MYT',
    },
  });
});

// PATCH /api/settings - Update configuration
settingsRoute.patch('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, string>>();

  const now = new Date().toISOString();
  const allowedKeys = [
    'send_enabled',
    'dry_run',
    'daily_cap',
    'daily_cap_ramp',
    'random_delay_min_sec',
    'random_delay_max_sec',
    'send_window_start',
    'send_window_end',
    'followup_after_days',
    'pledge_target',
  ];

  for (const [key, val] of Object.entries(body)) {
    if (allowedKeys.includes(key)) {
      await db
        .prepare(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind(key, String(val), now)
        .run();

      await db
        .prepare(
          'INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)'
        )
        .bind(user.email, 'update_setting', `Changed setting ${key} to ${val}`, now)
        .run();
    }
  }

  return c.json({ success: true, updated_at: now });
});

// POST /api/settings/backup - Trigger manual backup
settingsRoute.post('/backup', async (c) => {
  const res = await performDailyBackup(c.env);
  return c.json(res);
});

// GET /api/settings/backups - List backups
settingsRoute.get('/backups', async (c) => {
  if (!c.env.ASSETS_BUCKET) {
    return c.json({ backups: [] });
  }

  const list = await c.env.ASSETS_BUCKET.list({ prefix: 'backups/', limit: 20 });
  const backups = list.objects.map((o) => ({
    key: o.key,
    sizeBytes: o.size,
    uploadedAt: o.uploaded.toISOString(),
  }));

  return c.json({ backups });
});

export default settingsRoute;
