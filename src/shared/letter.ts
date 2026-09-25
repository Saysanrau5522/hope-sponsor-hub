import * as fflate from 'fflate';
import { formatLetterDateMYT } from './time';
import { generateRefNo } from './csv';

/**
 * XML-escape company name and parameters for Word OpenXML.
 * Critical for names with & (Fraser & Neave), apostrophes (Nando's), quotes, or brackets.
 */
export function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface LetterCompanyInput {
  company_name: string;
  display_name?: string;
  ref_no?: string;
  seq?: number;
}

export interface GeneratedLetter {
  docxBytes: Uint8Array;
  refNo: string;
  dateText: string;
}

// Global isolate in-memory cache for the unzipped template files
let cachedTemplateEntries: Record<string, Uint8Array> | null = null;
let cachedTemplateXmlString: string | null = null;

export function setCachedTemplate(templateBytes: Uint8Array) {
  cachedTemplateEntries = fflate.unzipSync(templateBytes);
  cachedTemplateXmlString = fflate.strFromU8(cachedTemplateEntries['word/document.xml']);
}

export function clearTemplateCache() {
  cachedTemplateEntries = null;
  cachedTemplateXmlString = null;
}

/**
 * Paragraph-level replace in Word XML:
 * Concatenates all <w:t> tags in a paragraph, locates match,
 * writes replacement into the first run that touches the match,
 * and clears matched characters from subsequent runs.
 */
export function replaceInParagraphXml(
  pXml: string,
  searchPattern: string | RegExp,
  replacement: string
): { newPXml: string; replaced: boolean } {
  const tTagRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const runs: Array<{
    matchIndex: number;
    fullLength: number;
    openTag: string;
    closeTag: string;
    text: string;
    startInP: number;
    endInP: number;
    newText?: string;
  }> = [];

  let concatText = '';
  let m: RegExpExecArray | null;

  while ((m = tTagRegex.exec(pXml)) !== null) {
    const full = m[0];
    const openTag = full.substring(0, full.indexOf('>') + 1);
    const closeTag = '</w:t>';
    const text = m[1];
    const startInP = concatText.length;
    concatText += text;
    const endInP = concatText.length;

    runs.push({
      matchIndex: m.index,
      fullLength: full.length,
      openTag,
      closeTag,
      text,
      startInP,
      endInP,
    });
  }

  const match =
    typeof searchPattern === 'string'
      ? (() => {
          const idx = concatText.indexOf(searchPattern);
          return idx !== -1 ? { index: idx, length: searchPattern.length } : null;
        })()
      : (() => {
          const sm = searchPattern.exec(concatText);
          return sm ? { index: sm.index, length: sm[0].length } : null;
        })();

  if (!match) {
    return { newPXml: pXml, replaced: false };
  }

  const matchStart = match.index;
  const matchEnd = match.index + match.length;

  let firstTouched = true;
  for (const r of runs) {
    const overlaps = Math.max(r.startInP, matchStart) < Math.min(r.endInP, matchEnd);
    if (!overlaps) continue;

    const relStart = Math.max(0, matchStart - r.startInP);
    const relEnd = Math.min(r.text.length, matchEnd - r.startInP);

    const prefix = r.text.substring(0, relStart);
    const suffix = r.text.substring(relEnd);

    if (firstTouched) {
      r.newText = prefix + replacement + suffix;
      firstTouched = false;
    } else {
      r.newText = prefix + suffix;
    }
  }

  // Reconstruct paragraph XML backwards
  let newPXml = pXml;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    if (r.newText !== undefined) {
      const newTag = r.openTag + r.newText + r.closeTag;
      newPXml = newPXml.substring(0, r.matchIndex) + newTag + newPXml.substring(r.matchIndex + r.fullLength);
    }
  }

  return { newPXml, replaced: true };
}

/**
 * Extract all plain text from a DOCX byte array by concatenating <w:t> content in word/document.xml.
 */
export function extractDocxText(docxBytes: Uint8Array, decodeEntities = true): string {
  const unzipped = fflate.unzipSync(docxBytes);
  const docXml = fflate.strFromU8(unzipped['word/document.xml']);
  const matches = docXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
  let text = matches
    .map((tag) => tag.replace(/^<w:t(?:\s+[^>]*)?>/, '').replace(/<\/w:t>$/, ''))
    .join('');
  if (decodeEntities) {
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  return text;
}

/**
 * Generate letter just-in-time from template DOCX bytes.
 * Dates the letter in Asia/Kuala_Lumpur (MYT).
 */
export function generateLetter(
  company: LetterCompanyInput,
  now: Date = new Date(),
  templateBytes?: Uint8Array
): GeneratedLetter {
  if (!cachedTemplateEntries || !cachedTemplateXmlString) {
    if (!templateBytes) {
      throw new Error('Template bytes not provided and template is not cached in memory');
    }
    setCachedTemplate(templateBytes);
  }

  const dateText = formatLetterDateMYT(now);
  const refNo = company.ref_no || generateRefNo(company.seq || 1);
  const rawCompanyName = company.display_name || company.company_name;
  const escapedCompanyName = xmlEscape(rawCompanyName);

  let docXml = cachedTemplateXmlString!;

  // 1. Replace Reference Number (split across runs in Ref No table cell)
  const oldRefText = 'USM/SSI2627/HOPE/SLF/01';
  let refCount = 0;
  docXml = docXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (pXml) => {
    if (pXml.includes('USM/SSI2')) {
      const res = replaceInParagraphXml(pXml, oldRefText, refNo);
      if (res.replaced) refCount++;
      return res.newPXml;
    }
    return pXml;
  });

  // 2. Replace Date ("10 SEPTEMBER 2026")
  const oldDateText = '10 SEPTEMBER 2026';
  let dateCount = 0;
  if (docXml.includes(oldDateText)) {
    docXml = docXml.replace(oldDateText, dateText);
    dateCount = 1;
  }

  // 3. Replace Company Name (3 occurrences with tolerant regex)
  // Match: [Recipient's Name/Organization], [Recipient's Name/ Organization], [Recipient’s Name/Organization]
  const recipientRegex = /\[Recipient['’]s Name\/\s?Organization\]/g;
  let companyCount = 0;
  docXml = docXml.replace(recipientRegex, () => {
    companyCount++;
    return escapedCompanyName;
  });

  // 4. Remove yellow highlights on template placeholders (Date, Company Name, Ref No)
  docXml = docXml.replace(/<w:highlight\b[^>]*\/>/g, '');

  // STRICT ASSERTIONS (Non-negotiable rule from section 6):
  // Assert: no [Recipient remains; the old ref and old date no longer appear;
  // exactly 3 company replacements, 1 ref and 1 date were made.
  const hasRemainingRecipient = /\[Recipient/i.test(docXml);
  const oldRefRemains = refNo !== oldRefText && docXml.includes(oldRefText);
  const oldDateRemains = dateText !== oldDateText && docXml.includes(oldDateText);

  if (
    hasRemainingRecipient ||
    oldRefRemains ||
    oldDateRemains ||
    refCount !== 1 ||
    dateCount !== 1 ||
    companyCount !== 3
  ) {
    throw new Error(
      `template error: assertions failed (ref: ${refCount}/1, date: ${dateCount}/1, company: ${companyCount}/3, recipientRemains: ${hasRemainingRecipient})`
    );
  }

  // Re-zip DOCX with media uncompressed (level 0) for sub-8ms CPU time
  const zipFiles: Record<string, [Uint8Array, { level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }]> = {};
  for (const [name, content] of Object.entries(cachedTemplateEntries!)) {
    if (name === 'word/document.xml') {
      zipFiles[name] = [fflate.strToU8(docXml), { level: 1 }];
    } else if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
      zipFiles[name] = [content, { level: 0 }]; // Keep images uncompressed
    } else {
      zipFiles[name] = [content, { level: 0 }]; // Fast store
    }
  }

  const docxBytes = fflate.zipSync(zipFiles as any);

  return {
    docxBytes,
    refNo,
    dateText,
  };
}
