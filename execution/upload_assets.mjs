import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isRemote = process.argv.includes('--remote');
const targetEnv = isRemote ? '--remote' : '--local';

const proposalPdfPath = path.join(rootDir, 'assets', 'Sponsor Proposal HOPE 5.0.pdf');
const letterDocxPath = path.join(rootDir, 'assets', 'HOPE Sponsorship Letter 26_27 Template.docx');
const sponsorsCsvPath = path.join(rootDir, 'assets', 'hope_sponsors_clean.csv');

console.log(`[R2 Asset Prep] Mode: ${isRemote ? 'REMOTE' : 'LOCAL'}`);

if (!fs.existsSync(proposalPdfPath) || !fs.existsSync(letterDocxPath) || !fs.existsSync(sponsorsCsvPath)) {
  console.error('Error: One or more asset files missing in assets/ directory');
  process.exit(1);
}

// 1. Prepare Base64 proposal
const proposalBytes = fs.readFileSync(proposalPdfPath);
const proposalBase64 = proposalBytes.toString('base64');
const tmpDir = path.join(rootDir, '.tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const proposalB64Path = path.join(tmpDir, 'proposal.base64');
fs.writeFileSync(proposalB64Path, proposalBase64, 'utf8');

console.log(`[R2 Asset Prep] Proposal PDF size: ${(proposalBytes.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`[R2 Asset Prep] Proposal Base64 size: ${(proposalBase64.length / 1024 / 1024).toFixed(2)} MB`);

const filesToUpload = [
  { source: proposalPdfPath, destination: 'assets/proposal.pdf' },
  { source: proposalB64Path, destination: 'assets/proposal.base64' },
  { source: letterDocxPath, destination: 'assets/template.docx' },
  { source: sponsorsCsvPath, destination: 'assets/sponsors_seed.csv' },
];

console.log(`[R2 Asset Prep] Ready to upload 4 asset files to R2 bucket 'hope-assets':`);
for (const f of filesToUpload) {
  console.log(`  -> ${f.destination} (from ${path.basename(f.source)})`);
}

// Try uploading via wrangler if bucket exists, or log command
for (const f of filesToUpload) {
  try {
    const cmd = `npx.cmd wrangler r2 object put hope-assets/${f.destination} --file="${f.source}" ${targetEnv}`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
  } catch (err) {
    console.warn(`Note: Direct wrangler r2 upload skipped: ${err.message}`);
  }
}

console.log('[R2 Asset Prep] Completed.');
