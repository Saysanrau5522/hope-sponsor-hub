import { describe, it, expect } from 'vitest';
import {
  rfc2047EncodeSubject,
  sanitizeAsciiFilename,
  buildMimeMessage,
} from '../src/shared/mime';

describe('MIME Message Builder (Phase 3 Acceptance)', () => {
  it('RFC 2047 encodes subjects containing em dash and non-ASCII chars', () => {
    const rawSubject = 'REQUEST FOR SPONSORSHIP FOR HOPE 5.0 — CHASE THE LIGHT';
    const encoded = rfc2047EncodeSubject(rawSubject);

    expect(encoded).toContain('=?UTF-8?B?');
    expect(encoded).toContain('?=');

    // Pure ASCII subjects should not be altered
    expect(rfc2047EncodeSubject('TEST ASCII SUBJECT')).toBe('TEST ASCII SUBJECT');
  });

  it('sanitises attachment filenames to safe ASCII characters', () => {
    expect(sanitizeAsciiFilename("TEST & CO. (M) SDN BHD/")).toBe('TEST_CO._M_SDN_BHD_');
    expect(sanitizeAsciiFilename("Nando's Chicken")).toBe('Nando_s_Chicken');
  });

  it('builds complete multipart/mixed RFC 822 MIME message with both attachments and tracking pixel', () => {
    const fakeDocx = new Uint8Array([80, 75, 3, 4]); // PK..
    const fakeProposalB64 = btoa('Fake PDF Content');

    const mime = buildMimeMessage({
      fromName: 'HOPE 5.0 | SSI USM',
      fromEmail: 'hopebyssi@gmail.com',
      toEmail: 'sponsor@company.com',
      companyName: 'ACME SDN BHD',
      subject: 'REQUEST FOR SPONSORSHIP FOR HOPE 5.0 — CHASE THE LIGHT',
      outreachId: 101,
      trackingToken: 'abcdef1234567890abcdef1234567890abcdef1234567890',
      pixelHost: 'hope-pixel.workers.dev',
      proposalBase64: fakeProposalB64,
      letterDocxBytes: fakeDocx,
    });

    // 1. Headers
    expect(mime).toContain('From: "HOPE 5.0 | SSI USM" <hopebyssi@gmail.com>');
    expect(mime).toContain('Reply-To: hopebyssi@gmail.com');
    expect(mime).toContain('To: sponsor@company.com');
    expect(mime).toContain('Message-ID: <hope-101@hope-sponsor-hub>');
    expect(mime).toContain('Content-Type: multipart/mixed; boundary="boundary_mixed_101_');

    // 2. Body parts
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="boundary_alt_101_');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Dear ACME SDN BHD,');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');

    // 3. Tracking pixel in HTML
    expect(mime).toContain('https://hope-pixel.workers.dev/t/abcdef1234567890abcdef1234567890abcdef1234567890.gif');

    // 4. Attachments
    expect(mime).toContain('Content-Type: application/pdf; name="Sponsor_Proposal_HOPE_5_0.pdf"');
    expect(mime).toContain('Content-Disposition: attachment; filename="Sponsor_Proposal_HOPE_5_0.pdf"');
    expect(mime).toContain(fakeProposalB64);

    expect(mime).toContain('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document; name="HOPE_5_0_Sponsorship_Letter_ACME_SDN_BHD.docx"');
    expect(mime).toContain('Content-Disposition: attachment; filename="HOPE_5_0_Sponsorship_Letter_ACME_SDN_BHD.docx"');
  });
});
