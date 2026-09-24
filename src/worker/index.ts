import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { accessAuthMiddleware, WorkerEnv } from './middleware/access';
import sponsorsRoute from './routes/sponsors';
import problemsRoute from './routes/problems';
import validateRoute from './routes/validate';
import authRoute from './routes/auth';
import templatesRoute from './routes/templates';
import gmailRoute from './routes/gmail';
import queueRoute from './routes/queue';
import repliesRoute from './routes/replies';
import callsRoute from './routes/calls';
import analyticsRoute from './routes/analytics';
import settingsRoute from './routes/settings';
import { processQueueTick } from './services/queue';
import { pollInboxTick } from './services/inbox';
import { performDailyBackup } from './services/backup';
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
app.route('/api/queue', queueRoute);
app.route('/api/replies', repliesRoute);
app.route('/api/calls', callsRoute);
app.route('/api/analytics', analyticsRoute);
app.route('/api/settings', settingsRoute);

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
      // Send tick (every minute)
      ctx.waitUntil(
        (async () => {
          try {
            const res = await processQueueTick(env, new Date());
            if (res.processed) {
              console.log(`[Cron Send Tick] Sent outreach ${res.outreachId} to ${res.companyName}`);
            } else {
              console.log(`[Cron Send Tick] Idle: ${res.reason}`);
            }
          } catch (err) {
            console.error('[Cron Send Tick] Error during send tick:', err);
          }
        })()
      );
    } else if (cron === '*/5 * * * *') {
      // Inbox poll (every 5 minutes)
      ctx.waitUntil(
        (async () => {
          try {
            const res = await pollInboxTick(env);
            console.log(`[Cron Inbox Poll] Checked ${res.checkedCount} msgs: ${res.newRepliesCount} replies, ${res.newBouncesCount} bounces, ${res.newAutoRepliesCount} auto-replies`);
            if (res.errors.length > 0) {
              console.warn('[Cron Inbox Poll] Warnings/Errors:', res.errors);
            }
          } catch (err) {
            console.error('[Cron Inbox Poll] Error during poll tick:', err);
          }
        })()
      );
    } else if (cron === '0 1 * * *') {
      // Daily backup and snapshot to R2 (01:00 UTC / 09:00 MYT)
      ctx.waitUntil(
        (async () => {
          try {
            const res = await performDailyBackup(env);
            console.log(`[Cron Daily Backup] Successfully backed up to ${res.backupPath} (${res.sizeBytes} bytes)`);
          } catch (err) {
            console.error('[Cron Daily Backup] Error during daily backup:', err);
          }
        })()
      );
    }
  },
};
