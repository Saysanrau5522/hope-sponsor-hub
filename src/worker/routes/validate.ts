import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { validateEmailBatch } from '../../shared/validation';
import { classifyContactQuality } from '../../shared/csv';

const validateRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// GET /api/validate/status - Progress stats of email validation
validateRoute.get('/status', async (c) => {
  const db = c.env.DB;

  const res = await db
    .prepare(`
      SELECT 
        COUNT(*) as total_with_email,
        SUM(CASE WHEN validated_at IS NOT NULL THEN 1 ELSE 0 END) as total_validated,
        SUM(CASE WHEN validated_at IS NULL AND primary_email IS NOT NULL THEN 1 ELSE 0 END) as remaining_to_validate
      FROM sponsors
      WHERE primary_email IS NOT NULL
    `)
    .first<any>();

  return c.json({
    total_with_email: res?.total_with_email || 0,
    total_validated: res?.total_validated || 0,
    remaining_to_validate: res?.remaining_to_validate || 0,
  });
});

// POST /api/validate/chunk - Run validation on a chunk of up to 25 sponsors
validateRoute.post('/chunk', async (c) => {
  const db = c.env.DB;
  const CHUNK_SIZE = 25; // 25 domains safely stays under the 50 subrequest limit

  // Pick next unvalidated batch
  const sponsorsRes = await db
    .prepare(`
      SELECT id, seq, company_name, type, primary_email, email_status, contact_quality
      FROM sponsors
      WHERE primary_email IS NOT NULL AND validated_at IS NULL
      ORDER BY seq ASC
      LIMIT ?
    `)
    .bind(CHUNK_SIZE)
    .all<Sponsor>();

  const batch = sponsorsRes.results || [];
  if (batch.length === 0) {
    return c.json({
      processed: 0,
      remaining: 0,
      completed: true,
      message: 'All emails are already validated',
    });
  }

  const emailsToTest = batch.map((s) => s.primary_email!).filter(Boolean);
  const validationResults = await validateEmailBatch(emailsToTest, fetch);

  const now = new Date().toISOString();
  const updateStatements: D1PreparedStatement[] = [];

  for (const s of batch) {
    const val = validationResults.get(s.primary_email!);
    const newStatus = val ? val.status : s.email_status;
    const newQuality = classifyContactQuality(s.primary_email, s.company_name, s.type || '');

    updateStatements.push(
      db
        .prepare(`
          UPDATE sponsors 
          SET 
            email_status = ?,
            contact_quality = ?,
            validated_at = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(newStatus, newQuality, now, now, s.id)
    );
  }

  if (updateStatements.length > 0) {
    await db.batch(updateStatements);
  }

  // Count remaining
  const remainingRes = await db
    .prepare(`
      SELECT COUNT(*) as remaining
      FROM sponsors
      WHERE primary_email IS NOT NULL AND validated_at IS NULL
    `)
    .first<any>();

  const remaining = remainingRes?.remaining || 0;

  return c.json({
    processed: batch.length,
    remaining,
    completed: remaining === 0,
    updated: batch.map((s) => ({
      id: s.id,
      company: s.company_name,
      email: s.primary_email,
      status: validationResults.get(s.primary_email!)?.status || s.email_status,
    })),
  });
});

export default validateRoute;
