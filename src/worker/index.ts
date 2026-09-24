import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { accessAuthMiddleware, WorkerEnv } from './middleware/access';
import sponsorsRoute from './routes/sponsors';
import problemsRoute from './routes/problems';
import validateRoute from './routes/validate';
import authRoute from './routes/auth';
import templatesRoute from './routes/templates';
import gmailRoute from './routes/gmail';
import { AuthUser } from '../shared/types';

const app = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// Enable CORS for development frontend
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cf-Access-Jwt-Assertion', 'X-Dev-User-Email'],
  })
);

// Health check endpoint (public)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'hope-sponsor-hub', time: new Date().toISOString() });
});

// Protect all /api/* routes with Cloudflare Access Identity Middleware
app.use('/api/*', accessAuthMiddleware);

// Mount API sub-routers
app.route('/api/auth', authRoute);
app.route('/api/sponsors', sponsorsRoute);
app.route('/api/problems', problemsRoute);
app.route('/api/validate', validateRoute);
app.route('/api/templates', templatesRoute);
app.route('/api/gmail', gmailRoute);

// Fallback to static frontend assets if bound
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('HOPE Sponsor Hub API ready. Frontend assets not mounted or running locally.', 404);
});

export default {
  fetch: app.fetch,

  // Single scheduled handler switching on controller.cron
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    const cron = controller.cron;
    console.log(`[Cron Triggered] ${cron} at ${new Date().toISOString()}`);

    if (cron === '* * * * *') {
      // Send tick (processed in Phase 4)
      console.log('[Cron] Send tick minute handler');
    } else if (cron === '*/5 * * * *') {
      // Inbox poll (processed in Phase 5)
      console.log('[Cron] Inbox poll 5-minute handler');
    } else if (cron === '0 1 * * *') {
      // Daily backup and digest (processed in Phase 6)
      console.log('[Cron] Daily backup & digest handler (01:00 UTC / 09:00 MYT)');
    }
  },
};
