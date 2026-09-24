import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser } from '../../shared/types';

const authRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

authRoute.get('/me', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const settingsRows = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const settings: Record<string, string> = {};
  for (const row of settingsRows.results || []) {
    settings[row.key] = row.value;
  }

  return c.json({
    user,
    environment: c.env.ENVIRONMENT || 'development',
    settings,
  });
});

export default authRoute;
