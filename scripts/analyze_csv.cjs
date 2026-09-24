const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'assets', 'hope_sponsors_clean.csv');
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row = [];
    let insideQuote = false;
    let entry = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry);
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry);
    rows.push(row.map(s => s.trim()));
  }
  return rows;
}

const rows = parseCSV(raw);
const headers = rows[0];
const data = rows.slice(1);

console.log('Total rows:', data.length);
console.log('Headers:', headers);

let withEmail = 0;
let noEmail = 0;
let unusable = 0;
const emailMap = new Map();

data.forEach((r, idx) => {
  const seq = r[0];
  const name = r[1];
  const type = r[2];
  const primary_email = r[3];
  const alt_emails = r[4];
  const phone = r[5];
  const website = r[6];
  const email_raw = r[7];
  const flags = r[8];
  const status = r[9];

  if (!primary_email || primary_email === 'Not in source') {
    noEmail++;
  } else {
    withEmail++;
    const key = primary_email.toLowerCase();
    if (!emailMap.has(key)) emailMap.set(key, []);
    emailMap.get(key).push({ seq, name });
  }
});

console.log('With email:', withEmail);
console.log('No email / Not in source:', noEmail);

const duplicates = [];
for (const [email, list] of emailMap.entries()) {
  if (list.length > 1) {
    duplicates.push({ email, count: list.length, companies: list });
  }
}
console.log('Duplicate email groups count:', duplicates.length);
console.log('Duplicate groups:', JSON.stringify(duplicates, null, 2));
