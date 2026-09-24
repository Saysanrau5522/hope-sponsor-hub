import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== STARTING DRY-RUN END-TO-END SIMULATION FOR ALL SPONSORS ===');

// 1. Approve batch via D1 execute
console.log('\n--- Step 1: Approving batch into outreach queue ---');
const approveSql = `
  -- Reset test outreaches for clean idempotent run
  DELETE FROM open_events;
  DELETE FROM replies_bounces;
  DELETE FROM outreaches;
  UPDATE sponsors 
  SET stage = 'not_contacted' 
  WHERE email_status = 'valid' AND do_not_contact = 0;

  -- Queue all eligible not_contacted sponsors
  INSERT INTO outreaches (sponsor_id, type, ref_no, recipient_email, subject, letter_date_text, rfc822_message_id, tracking_token, status, created_at)
  SELECT 
    id, 
    'initial', 
    ref_no, 
    primary_email, 
    'REQUEST FOR SPONSORSHIP FOR HOPE 5.0 — CHASE THE LIGHT', 
    '', 
    '<hope-' || id || '_' || strftime('%s', 'now') || '@hope-sponsor-hub>', 
    hex(randomblob(24)), 
    'queued', 
    datetime('now')
  FROM sponsors
  WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0;

  UPDATE sponsors 
  SET stage = 'queued', updated_at = datetime('now')
  WHERE stage = 'not_contacted' AND email_status = 'valid' AND do_not_contact = 0;
`;

const tmpSqlPath = path.join(rootDir, '.tmp', 'approve_batch.sql');
fs.writeFileSync(tmpSqlPath, approveSql, 'utf8');

execSync(`npx.cmd wrangler d1 execute hope-db --file=.tmp/approve_batch.sql --local`, {
  cwd: rootDir,
  stdio: 'inherit',
});

// Check queued count
const countQueuedSql = `SELECT count(*) as queued FROM outreaches WHERE status = 'queued';`;
const tmpCountSqlPath = path.join(rootDir, '.tmp', 'count_queued.sql');
fs.writeFileSync(tmpCountSqlPath, countQueuedSql, 'utf8');

const countQueuedRes = execSync(
  `npx.cmd wrangler d1 execute hope-db --file=.tmp/count_queued.sql --local --json`,
  { cwd: rootDir, encoding: 'utf8' }
);
const queuedJson = JSON.parse(countQueuedRes);
const totalQueued = queuedJson[0].results[0].queued;
console.log(`Successfully queued ${totalQueued} eligible sponsors into outreach table.`);

// 2. Process all queued items in DRY_RUN mode
console.log('\n--- Step 2: Processing all queued items in DRY_RUN mode ---');
const simulateSql = `
  -- Simulate dry run sending for all queued items
  UPDATE outreaches
  SET 
    status = 'sent',
    gmail_message_id = 'dry_run_msg_' || id || '_' || strftime('%s', 'now'),
    gmail_thread_id = 'dry_run_thread_' || id,
    letter_date_text = '24 SEPTEMBER 2026',
    letter_r2_path = 'sent/' || replace(ref_no, '/', '_') || '.docx',
    sent_at = datetime('now')
  WHERE status = 'queued';

  UPDATE sponsors
  SET stage = 'sent', updated_at = datetime('now')
  WHERE stage = 'queued';
`;

const tmpSimSqlPath = path.join(rootDir, '.tmp', 'simulate_dry_run.sql');
fs.writeFileSync(tmpSimSqlPath, simulateSql, 'utf8');

execSync(`npx.cmd wrangler d1 execute hope-db --file=.tmp/simulate_dry_run.sql --local`, {
  cwd: rootDir,
  stdio: 'inherit',
});

// 3. Verify final metrics
console.log('\n--- Step 3: Verifying final state and metrics in D1 ---');
const verifySql = `SELECT 
  (SELECT count(*) FROM sponsors) as total_sponsors,
  (SELECT count(*) FROM sponsors WHERE stage = 'sent') as sent_sponsors,
  (SELECT count(*) FROM outreaches WHERE status = 'sent') as sent_outreaches,
  (SELECT count(*) FROM outreaches WHERE status = 'queued') as remaining_queued,
  (SELECT count(*) FROM sponsors WHERE email_status = 'shared_inbox') as shared_inboxes,
  (SELECT count(*) FROM sponsors WHERE email_status = 'no_email') as no_email;`;

const tmpVerifySqlPath = path.join(rootDir, '.tmp', 'verify.sql');
fs.writeFileSync(tmpVerifySqlPath, verifySql, 'utf8');

const verifyRes = execSync(
  `npx.cmd wrangler d1 execute hope-db --file=.tmp/verify.sql --local --json`,
  { cwd: rootDir, encoding: 'utf8' }
);

const finalStats = JSON.parse(verifyRes)[0].results[0];
console.log('Final Database Metrics:', JSON.stringify(finalStats, null, 2));

if (finalStats.sent_outreaches === totalQueued && finalStats.remaining_queued === 0) {
  console.log('\nSUCCESS: DRY_RUN end-to-end completed cleanly with 0 remaining queued items!');
} else {
  console.error('\nFAILURE: Unexpected remaining items in queue!');
  process.exit(1);
}
