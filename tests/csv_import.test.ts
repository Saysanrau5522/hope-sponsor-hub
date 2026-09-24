import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  processSponsorsCSV,
  generateRefNo,
  cleanDisplayName,
  cleanEmailAddress,
  classifyContactQuality,
} from '../src/shared/csv';

describe('Sponsor CSV Import and Processing (Phase 1 Acceptance)', () => {
  const csvPath = path.resolve(__dirname, '../assets/hope_sponsors_clean.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');

  it('meets Phase 1 acceptance: 485 companies, 399 with emails, 85 no-email + 1 unusable (86 total), 6 duplicate groups', () => {
    const { sponsors, stats } = processSponsorsCSV(csvText);

    expect(stats.total).toBe(485);
    expect(sponsors.length).toBe(485);
    expect(stats.withEmail).toBe(399);
    expect(stats.noEmail).toBe(86);
    expect(stats.duplicateGroupsCount).toBe(6);
  });

  it('flags 46 freemail addresses and 1 suspicious domain (Rico Food Industries)', () => {
    const { sponsors, stats } = processSponsorsCSV(csvText);

    expect(stats.freemailCount).toBe(46);
    expect(stats.suspiciousDomainCount).toBe(1);

    const rico = sponsors.find((s) => s.company_name.includes('Rico Food'));
    expect(rico).toBeDefined();
    expect(rico?.email_status).toBe('suspicious_domain');
  });

  it('correctly handles duplicate email groups: first is eligible, others marked shared_inbox', () => {
    const { sponsors } = processSponsorsCSV(csvText);

    // Giant / Mercato / Happy Fresh shared email
    const giant = sponsors.find((s) => s.company_name === 'GCH Retail (M) Sdn Bhd.');
    const mercato = sponsors.find((s) => s.company_name === 'Mercato Pavilion');
    const happyFresh = sponsors.find((s) => s.company_name === 'Happy Fresh Malaysia');

    expect(giant?.email_status).toBe('valid');
    expect(mercato?.email_status).toBe('shared_inbox');
    expect(mercato?.shared_with_company).toContain('GCH Retail');
    expect(happyFresh?.email_status).toBe('shared_inbox');
    expect(happyFresh?.shared_with_company).toContain('GCH Retail');

    // Count all shared_inbox rows
    const sharedInboxes = sponsors.filter((s) => s.email_status === 'shared_inbox');
    // In 6 groups with 13 total companies, 13 - 6 = 7 are secondary/tertiary shared inboxes!
    expect(sharedInboxes.length).toBe(7);
  });

  it('generates unique ref_no for all 485 sponsors with zero padding', () => {
    const { sponsors } = processSponsorsCSV(csvText);
    const refNos = new Set(sponsors.map((s) => s.ref_no));

    expect(refNos.size).toBe(485);
    expect(generateRefNo(1)).toBe('USM/SSI2627/HOPE/SLF/01');
    expect(generateRefNo(99)).toBe('USM/SSI2627/HOPE/SLF/99');
    expect(generateRefNo(100)).toBe('USM/SSI2627/HOPE/SLF/100');
    expect(generateRefNo(485)).toBe('USM/SSI2627/HOPE/SLF/485');
  });

  it('is completely idempotent: re-processing gives identical records and stats', () => {
    const run1 = processSponsorsCSV(csvText);
    const run2 = processSponsorsCSV(csvText);

    expect(run1.stats).toEqual(run2.stats);
    expect(run1.sponsors.length).toBe(run2.sponsors.length);

    for (let i = 0; i < run1.sponsors.length; i++) {
      expect(run1.sponsors[i].seq).toBe(run2.sponsors[i].seq);
      expect(run1.sponsors[i].ref_no).toBe(run2.sponsors[i].ref_no);
      expect(run1.sponsors[i].primary_email).toBe(run2.sponsors[i].primary_email);
      expect(run1.sponsors[i].email_status).toBe(run2.sponsors[i].email_status);
      expect(run1.sponsors[i].email_raw).toBe(run2.sponsors[i].email_raw);
    }
  });

  it('preserves names without title casing (e.g. MR.D.I.Y. and A&W)', () => {
    expect(cleanDisplayName('  MR.D.I.Y. (TRADING) SDN BHD   ')).toBe('MR.D.I.Y. (TRADING) SDN BHD');
    expect(cleanDisplayName('A&W MALAYSIA')).toBe('A&W MALAYSIA');
  });

  it('cleans emails and removes trailing dots', () => {
    expect(cleanEmailAddress('test@company.com.')).toBe('test@company.com');
    expect(cleanEmailAddress('  TEST@DOMAIN.MY  ')).toBe('test@domain.my');
    expect(cleanEmailAddress(null)).toBeNull();
  });

  it('classifies contact quality into csr_or_foundation vs generic_inbox vs standard', () => {
    expect(classifyContactQuality('csr@yayasan.org', 'Yayasan Sime Darby', 'Foundation')).toBe('csr_or_foundation');
    expect(classifyContactQuality('info@acme.com', 'Acme Corp', 'F&B')).toBe('generic_inbox');
    expect(classifyContactQuality('john.doe@tech.com', 'Tech Corp', 'IT')).toBe('standard');
  });
});
