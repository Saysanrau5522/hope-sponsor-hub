import { VERBATIM_EMAIL_BODY_TEXT, renderEmailHtml } from './constants';

/**
 * RFC 2047 encode subject header if it contains non-ASCII characters (e.g. em dash —).
 * Format: =?UTF-8?B?<base64>?=
 */
export function rfc2047EncodeSubject(subject: string): string {
  // Check if subject has non-ASCII characters
  if (/^[\x20-\x7E]+$/.test(subject)) {
    return subject;
  }
  const utf8Bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}

/**
 * Sanitise attachment filenames to safe ASCII characters only.
 */
export function sanitizeAsciiFilename(filename: string): string {
  return filename
    .replace(/[^\w\.\-\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export interface BuildMimeOptions {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  companyName: string;
  subject: string;
  outreachId: number | string;
  trackingToken: string;
  pixelHost: string;
  proposalBase64: string; // Pre-encoded base64 text from R2
  letterDocxBytes: Uint8Array; // Generated letter binary
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  customBodyText?: string | null;
}

/**
 * Build RFC 822 MIME message for Gmail upload endpoint:
 * multipart/mixed
 *   ├── multipart/alternative
 *   │     ├── text/plain
 *   │     └── text/html (with 1x1 tracking pixel)
 *   ├── application/pdf (Sponsor_Proposal_HOPE_5_0.pdf)
 *   └── application/vnd.openxmlformats-officedocument.wordprocessingml.document (HOPE_5_0_Sponsorship_Letter_<CompanySlug>.docx)
 */
export function buildMimeMessage(opts: BuildMimeOptions): string {
  const {
    fromName,
    fromEmail,
    toEmail,
    companyName,
    subject,
    outreachId,
    trackingToken,
    pixelHost,
    proposalBase64,
    letterDocxBytes,
    threadId,
    inReplyTo,
    references,
    customBodyText,
  } = opts;

  const mixedBoundary = `boundary_mixed_${outreachId}_${Date.now()}`;
  const altBoundary = `boundary_alt_${outreachId}_${Date.now()}`;

  const encodedSubject = rfc2047EncodeSubject(subject);
  const messageId = `<hope-${outreachId}@hope-sponsor-hub>`;

  // Prepare body text and HTML
  const bodyText = customBodyText || VERBATIM_EMAIL_BODY_TEXT.replace(/\[Company Name\]/g, companyName);
  const cleanPixelHost = pixelHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const pixelUrl = `https://${cleanPixelHost}/t/${trackingToken}.gif`;
  const bodyHtml = renderEmailHtml(companyName, pixelUrl);

  // Encode letter DOCX to base64
  let letterBinary = '';
  for (let i = 0; i < letterDocxBytes.length; i++) {
    letterBinary += String.fromCharCode(letterDocxBytes[i]);
  }
  const letterBase64 = btoa(letterBinary);

  // Safe ASCII filenames
  const safeCompanySlug = sanitizeAsciiFilename(companyName);
  const letterFilename = `HOPE_5_0_Sponsorship_Letter_${safeCompanySlug}.docx`;
  const proposalFilename = 'Sponsor_Proposal_HOPE_5_0.pdf';

  // Construct MIME headers
  const headers: string[] = [
    `From: "${fromName}" <${fromEmail}>`,
    `Reply-To: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${encodedSubject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

  // Assemble MIME parts through string concatenation
  const mimeParts: string[] = [
    headers.join('\r\n'),
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    '',
    bodyText,
    '',
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    '',
    bodyHtml,
    '',
    `--${altBoundary}--`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${proposalFilename}"`,
    `Content-Disposition: attachment; filename="${proposalFilename}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    proposalBase64,
    '',
    `--${mixedBoundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document; name="${letterFilename}"`,
    `Content-Disposition: attachment; filename="${letterFilename}"`,
    `Content-Transfer-Encoding: base64`,
    '',
    letterBase64,
    '',
    `--${mixedBoundary}--`,
    '',
  ];

  return mimeParts.join('\r\n');
}
