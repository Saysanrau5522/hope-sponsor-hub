import type { Sponsor, EmailStatus, ContactQuality, SponsorStage } from './types.ts';

export const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.com.my',
  'ymail.com',
  'hotmail.com',
  'hotmail.my',
  'outlook.com',
  'outlook.my',
  'live.com',
  'icloud.com',
]);

export const SUSPICIOUS_DOMAINS = new Set([
  'lawngreen-weasel-345064.hostingersite.com',
]);

/**
 * Standard RFC 4180 CSV parser supporting quoted strings, commas, and newlines inside quotes.
 */
export function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [''];
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentRow[currentRow.length - 1] += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      rows.push(currentRow);
      currentRow = [''];
    } else {
      currentRow[currentRow.length - 1] += char;
    }
  }

  if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0].trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

export interface RawSponsorRow {
  seq: number;
  company_name: string;
  type: string;
  primary_email: string;
  alt_emails: string;
  phone: string;
  website: string;
  email_raw: string;
  flags: string;
  status: string;
}

/**
 * Generates the standardized reference number for a sponsor sequence number.
 * Example: seq 1 -> "USM/SSI2627/HOPE/SLF/01", seq 100 -> "USM/SSI2627/HOPE/SLF/100"
 */
export function generateRefNo(seq: number, prefix = 'USM/SSI2627/HOPE/SLF/'): string {
  const padded = seq < 100 ? String(seq).padStart(2, '0') : String(seq);
  return `${prefix}${padded}`;
}

/**
 * Clean display name by tidying whitespace without changing case.
 */
export function cleanDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Clean email address: lowercase, trim, remove trailing dot.
 */
export function cleanEmailAddress(email: string | null | undefined): string | null {
  if (!email) return null;
  let cleaned = email.trim().toLowerCase();
  while (cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  return cleaned || null;
}

/**
 * Classify contact quality:
 * - csr_or_foundation: suggests CSR, foundation, yayasan, sustainability, corporate, sponsor
 * - generic_inbox: info@, enquiry@, careline@, customercare@, support@, hello@, feedback@
 * - standard: normal direct or corporate domain
 */
export function classifyContactQuality(
  email: string | null,
  companyName = '',
  type = ''
): ContactQuality {
  const combined = `${email || ''} ${companyName} ${type}`.toLowerCase();
  const csrRegex = /(csr|foundation|yayasan|sustainability|corporate|sponsor)/i;
  if (csrRegex.test(combined)) {
    return 'csr_or_foundation';
  }

  if (email) {
    const localPart = email.split('@')[0] || '';
    const genericRegex = /^(info|enquiry|enquiries|careline|customercare|customer_care|support|hello|feedback|contact|sales|marketing|admin)$/i;
    if (genericRegex.test(localPart)) {
      return 'generic_inbox';
    }
  }

  return 'standard';
}

/**
 * Process raw CSV string into fully prepared Sponsor records with duplicate email detection,
 * freemail flagging, suspicious domain flagging, and ref_no generation.
 */
export function processSponsorsCSV(csvText: string): {
  sponsors: Omit<Sponsor, 'id'>[];
  stats: {
    total: number;
    withEmail: number;
    noEmail: number;
    duplicateGroupsCount: number;
    freemailCount: number;
    suspiciousDomainCount: number;
  };
} {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or missing headers');
  }

  const dataRows = rows.slice(1).filter((r) => r.length > 1 && r[0].trim() !== '');

  // First pass: track email occurrences to detect duplicates
  const emailOccurrences = new Map<string, { seq: number; companyName: string }[]>();

  for (const r of dataRows) {
    const seq = parseInt(r[0].trim(), 10);
    const company_name = r[1]?.trim() || '';
    let rawPrimary = r[3]?.trim() || '';

    // Check unusable text or "Not in source"
    if (
      !rawPrimary ||
      rawPrimary === 'Not in source' ||
      rawPrimary.toLowerCase().includes('aduanatmbppdotgovdotmy') ||
      rawPrimary.toLowerCase().includes('perbadanan')
    ) {
      continue;
    }

    const cleanedEmail = cleanEmailAddress(rawPrimary);
    if (cleanedEmail && cleanedEmail.includes('@')) {
      if (!emailOccurrences.has(cleanedEmail)) {
        emailOccurrences.set(cleanedEmail, []);
      }
      emailOccurrences.get(cleanedEmail)!.push({ seq, companyName: company_name });
    }
  }

  let duplicateGroupsCount = 0;
  for (const [, list] of emailOccurrences.entries()) {
    if (list.length > 1) {
      duplicateGroupsCount++;
    }
  }

  const sponsors: Omit<Sponsor, 'id'>[] = [];
  let withEmail = 0;
  let noEmail = 0;
  let freemailCount = 0;
  let suspiciousDomainCount = 0;

  const now = new Date().toISOString();

  for (const r of dataRows) {
    const seq = parseInt(r[0].trim(), 10);
    const company_name = r[1]?.trim() || '';
    const type = r[2]?.trim() || null;
    let rawPrimary = r[3]?.trim() || '';
    const alt_emails = r[4]?.trim() || null;
    const phone = r[5]?.trim() || null;
    const website = r[6]?.trim() || null;
    const email_raw = r[7] !== undefined ? r[7].trim() : rawPrimary;
    const csvFlags = r[8]?.trim() || '';
    const csvStatus = r[9]?.trim() || '';

    const ref_no = generateRefNo(seq);
    const display_name = cleanDisplayName(company_name);

    let primary_email: string | null = null;
    let email_status: EmailStatus = 'no_email';
    let contact_quality: ContactQuality = 'standard';
    let shared_with_company: string | null = null;
    let stage: SponsorStage = 'not_contacted';
    const flagList: string[] = [];

    // Check if unusable or "Not in source"
    const isUnusable =
      !rawPrimary ||
      rawPrimary === 'Not in source' ||
      rawPrimary.toLowerCase().includes('aduanatmbppdotgovdotmy') ||
      rawPrimary.toLowerCase().includes('perbadanan');

    if (isUnusable) {
      noEmail++;
      email_status = 'no_email';
      primary_email = null;
    } else {
      primary_email = cleanEmailAddress(rawPrimary);
      withEmail++;

      const domain = primary_email?.split('@')[1] || '';

      // Check suspicious domain
      if (SUSPICIOUS_DOMAINS.has(domain) || csvFlags.includes('SUSPICIOUS_DOMAIN')) {
        email_status = 'suspicious_domain';
        suspiciousDomainCount++;
        flagList.push('suspicious_domain');
      }
      // Check duplicate address
      else if (primary_email && emailOccurrences.has(primary_email)) {
        const occList = emailOccurrences.get(primary_email)!;
        const first = occList[0];
        if (first.seq === seq) {
          // First company keeps queued-eligible / valid status
          email_status = 'valid';
          stage = 'not_contacted';
        } else {
          // Subsequent companies get shared_inbox
          email_status = 'shared_inbox';
          shared_with_company = `Shared inbox with ${first.companyName} (Ref ${generateRefNo(first.seq)})`;
          flagList.push('shared_inbox');
        }
      } else {
        email_status = 'valid';
      }

      // Check freemail
      if (FREEMAIL_DOMAINS.has(domain) || csvFlags.includes('FREEMAIL')) {
        freemailCount++;
        flagList.push('freemail');
      }

      contact_quality = classifyContactQuality(primary_email, company_name, type || '');
    }

    if (csvFlags && !flagList.includes(csvFlags)) {
      flagList.push(csvFlags);
    }

    sponsors.push({
      seq,
      ref_no,
      company_name,
      display_name,
      type,
      primary_email,
      alt_emails,
      email_raw,
      phone,
      website,
      flags: flagList.length > 0 ? flagList.join('|') : null,
      email_status,
      contact_quality,
      shared_with_company,
      stage,
      owner: null,
      notes: null,
      do_not_contact: 0,
      already_contacted_date: null,
      pledge_tier: null,
      pledge_amount: 0,
      in_kind_description: null,
      pledge_received_amount: 0,
      validated_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    sponsors,
    stats: {
      total: dataRows.length,
      withEmail,
      noEmail,
      duplicateGroupsCount,
      freemailCount,
      suspiciousDomainCount,
    },
  };
}
