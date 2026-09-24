import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { processSponsorsCSV } from '../src/shared/csv.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isRemote = process.argv.includes('--remote');
const targetEnv = isRemote ? '--remote' : '--local';

const csvPath = path.join(rootDir, 'assets', 'hope_sponsors_clean.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');

const { sponsors, stats } = processSponsorsCSV(csvText);

console.log('[D1 Seed] CSV processed successfully:');
console.log(`  Total sponsors: ${stats.total}`);
console.log(`  With email: ${stats.withEmail}`);
console.log(`  No email: ${stats.noEmail}`);
console.log(`  Duplicate email groups: ${stats.duplicateGroupsCount}`);
console.log(`  Freemail flagged: ${stats.freemailCount}`);
console.log(`  Suspicious domain flagged: ${stats.suspiciousDomainCount}`);

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Generate idempotent SQL statements
const sqlStatements = [];

// 1. Initial settings if not present
const defaultSettings = [
  ['send_enabled', 'false'],
  ['dry_run', 'true'],
  ['sender_display_name', 'HOPE 5.0 | SSI USM'],
  ['sender_email', 'hopebyssi@gmail.com'],
  ['send_window_start', '09:00'],
  ['send_window_end', '16:30'],
  ['daily_cap', '25'],
  ['daily_cap_ramp', '25,50,80'],
  ['random_delay_min_sec', '60'],
  ['random_delay_max_sec', '180'],
  ['followup_after_days', '7'],
  ['hot_opens_threshold', '2'],
  ['hot_window_hours', '24'],
  ['ref_no_format', 'USM/SSI2627/HOPE/SLF/'],
  ['pledge_target', '10140'],
  ['timezone', 'Asia/Kuala_Lumpur'],
];

const now = new Date().toISOString();

for (const [key, val] of defaultSettings) {
  sqlStatements.push(
    `INSERT INTO settings (key, value, updated_at) VALUES (${sqlEscape(key)}, ${sqlEscape(val)}, ${sqlEscape(now)}) ON CONFLICT(key) DO NOTHING;`
  );
}

// 2. Insert or update sponsors idempotently on conflict(seq)
for (const s of sponsors) {
  sqlStatements.push(`
INSERT INTO sponsors (
  seq, ref_no, company_name, display_name, type, primary_email, alt_emails, email_raw,
  phone, website, flags, email_status, contact_quality, shared_with_company, stage,
  owner, notes, do_not_contact, already_contacted_date, pledge_tier, pledge_amount,
  in_kind_description, pledge_received_amount, validated_at, created_at, updated_at
) VALUES (
  ${s.seq}, ${sqlEscape(s.ref_no)}, ${sqlEscape(s.company_name)}, ${sqlEscape(s.display_name)},
  ${sqlEscape(s.type)}, ${sqlEscape(s.primary_email)}, ${sqlEscape(s.alt_emails)}, ${sqlEscape(s.email_raw)},
  ${sqlEscape(s.phone)}, ${sqlEscape(s.website)}, ${sqlEscape(s.flags)}, ${sqlEscape(s.email_status)},
  ${sqlEscape(s.contact_quality)}, ${sqlEscape(s.shared_with_company)}, ${sqlEscape(s.stage)},
  ${sqlEscape(s.owner)}, ${sqlEscape(s.notes)}, ${s.do_not_contact}, ${sqlEscape(s.already_contacted_date)},
  ${sqlEscape(s.pledge_tier)}, ${s.pledge_amount}, ${sqlEscape(s.in_kind_description)},
  ${s.pledge_received_amount}, ${sqlEscape(s.validated_at)}, ${sqlEscape(s.created_at)}, ${sqlEscape(s.updated_at)}
)
ON CONFLICT(seq) DO UPDATE SET
  company_name = excluded.company_name,
  type = excluded.type,
  phone = excluded.phone,
  website = excluded.website,
  flags = excluded.flags,
  shared_with_company = excluded.shared_with_company,
  updated_at = excluded.updated_at;
`.trim());
}

const tmpDir = path.join(rootDir, '.tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const sqlFile = path.join(tmpDir, 'seed.sql');
fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf8');

console.log(`[D1 Seed] Generated ${sqlStatements.length} SQL statements in .tmp/seed.sql`);

// Apply migration first, then execute seed
try {
  console.log(`Applying D1 migration (${targetEnv})...`);
  execSync(`npx wrangler d1 migrations apply hope-db ${targetEnv}`, { stdio: 'inherit', cwd: rootDir });

  console.log(`Executing D1 seed SQL (${targetEnv})...`);
  execSync(`npx wrangler d1 execute hope-db --file=.tmp/seed.sql ${targetEnv}`, { stdio: 'inherit', cwd: rootDir });

  console.log('[D1 Seed] Seed completed successfully!');
} catch (err) {
  console.error('[D1 Seed] Error applying to D1:', err.message);
  process.exit(1);
}
