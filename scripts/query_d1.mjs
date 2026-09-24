import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const res = execSync(
  'npx.cmd wrangler d1 execute hope-db --command "SELECT count(*) as total, sum(case when primary_email is not null then 1 else 0 end) as with_email, sum(case when primary_email is null then 1 else 0 end) as no_email, sum(case when email_status = \'shared_inbox\' then 1 else 0 end) as shared_inboxes, sum(case when email_status = \'suspicious_domain\' then 1 else 0 end) as suspicious FROM sponsors;" --local --json',
  { cwd: rootDir, encoding: 'utf8' }
);

console.log(res);
