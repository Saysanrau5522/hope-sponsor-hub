import { WorkerEnv } from '../middleware/access';

export interface BackupResult {
  success: boolean;
  backupPath: string;
  sizeBytes: number;
  timestamp: string;
  recordCounts: Record<string, number>;
}

/**
 * Performs daily backup of D1 tables into Cloudflare R2 bucket as a JSON snapshot.
 * Free-tier compliant: Uses batch/sequential queries and 1 R2 put (<10 subrequests).
 */
export async function performDailyBackup(env: WorkerEnv): Promise<BackupResult> {
  const db = env.DB;
  const now = new Date();
  
  // Format filename with MYT date
  const mytDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); // YYYY-MM-DD
  const mytTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }).replace(/:/g, '-');
  const backupKey = `backups/hope_db_${mytDate}_${mytTime}.json`;

  const [sponsorsRes, outreachesRes, opensRes, repliesRes, callsRes, settingsRes] = await Promise.all([
    db.prepare('SELECT * FROM sponsors').all(),
    db.prepare('SELECT * FROM outreaches').all(),
    db.prepare('SELECT * FROM open_events').all(),
    db.prepare('SELECT * FROM replies_bounces').all(),
    db.prepare('SELECT * FROM calls').all(),
    db.prepare('SELECT * FROM settings').all(),
  ]);

  const payload = {
    metadata: {
      generatedAtUTC: now.toISOString(),
      generatedAtMYT: `${mytDate} ${mytTime}`,
      version: '1.0.0',
      database: 'hope-db',
    },
    tables: {
      sponsors: sponsorsRes.results || [],
      outreaches: outreachesRes.results || [],
      open_events: opensRes.results || [],
      replies_bounces: repliesRes.results || [],
      calls: callsRes.results || [],
      settings: settingsRes.results || [],
    },
  };

  const jsonString = JSON.stringify(payload);
  const sizeBytes = new TextEncoder().encode(jsonString).length;

  if (env.ASSETS_BUCKET) {
    await env.ASSETS_BUCKET.put(backupKey, jsonString, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        totalSponsors: String(sponsorsRes.results?.length || 0),
        generatedAt: now.toISOString(),
      },
    });
  }

  // Record in activity_logs
  await db
    .prepare(
      'INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)'
    )
    .bind(
      'system_backup',
      'daily_backup_created',
      `Snapshot saved to ${backupKey} (${Math.round(sizeBytes / 1024)} KB)`,
      now.toISOString()
    )
    .run();

  return {
    success: true,
    backupPath: backupKey,
    sizeBytes,
    timestamp: now.toISOString(),
    recordCounts: {
      sponsors: sponsorsRes.results?.length || 0,
      outreaches: outreachesRes.results?.length || 0,
      open_events: opensRes.results?.length || 0,
      replies_bounces: repliesRes.results?.length || 0,
      calls: callsRes.results?.length || 0,
      settings: settingsRes.results?.length || 0,
    },
  };
}
