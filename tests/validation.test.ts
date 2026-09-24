import { describe, it, expect } from 'vitest';
import {
  isValidEmailSyntax,
  checkDomainDNS,
  validateEmailBatch,
  DoHResponse,
} from '../src/shared/validation';

describe('Email & DNS Validation', () => {
  it('validates syntax correctly', () => {
    expect(isValidEmailSyntax('user@domain.com')).toBe(true);
    expect(isValidEmailSyntax('user.name+tag@sub.domain.com.my')).toBe(true);
    expect(isValidEmailSyntax('invalid-email')).toBe(false);
    expect(isValidEmailSyntax('user@')).toBe(false);
    expect(isValidEmailSyntax('@domain.com')).toBe(false);
    expect(isValidEmailSyntax('user@domain..com')).toBe(false);
    expect(isValidEmailSyntax('user.@domain.com')).toBe(false);
  });

  it('validates domain using mock DoH fetch with MX record', async () => {
    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = url.toString();
      if (urlStr.includes('type=MX')) {
        const doh: DoHResponse = {
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Answer: [{ name: 'google.com', type: 15, data: '10 smtp.google.com', TTL: 300 }],
        };
        return new Response(JSON.stringify(doh), { status: 200 });
      }
      return new Response(JSON.stringify({ Status: 0 }), { status: 200 });
    };

    const res = await checkDomainDNS('google.com', mockFetch as any);
    expect(res.hasMx).toBe(true);
    expect(res.status).toBe('valid');
  });

  it('falls back to A record when MX is missing', async () => {
    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = url.toString();
      if (urlStr.includes('type=MX')) {
        return new Response(JSON.stringify({ Status: 0, Answer: [] }), { status: 200 });
      }
      if (urlStr.includes('type=A')) {
        const doh: DoHResponse = {
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Answer: [{ name: 'example.com', type: 1, data: '93.184.216.34', TTL: 300 }],
        };
        return new Response(JSON.stringify(doh), { status: 200 });
      }
      return new Response(JSON.stringify({ Status: 0 }), { status: 200 });
    };

    const res = await checkDomainDNS('example.com', mockFetch as any);
    expect(res.hasMx).toBe(false);
    expect(res.hasA).toBe(true);
    expect(res.status).toBe('valid');
  });

  it('marks domain as no_mx when neither MX nor A record exists', async () => {
    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      return new Response(JSON.stringify({ Status: 3, Answer: [] }), { status: 200 });
    };

    const res = await checkDomainDNS('nonexistent-domain-12345.xyz', mockFetch as any);
    expect(res.hasMx).toBe(false);
    expect(res.hasA).toBe(false);
    expect(res.status).toBe('no_mx');
  });

  it('runs batch validation in chunks with domain caching', async () => {
    let fetchCount = 0;
    const mockFetch = async (url: string | URL | Request): Promise<Response> => {
      fetchCount++;
      return new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ name: 'test.com', type: 15, data: '10 mail.test.com', TTL: 300 }],
        }),
        { status: 200 }
      );
    };

    const emails = [
      'a@test.com',
      'b@test.com', // same domain, should reuse cached DNS
      'c@test.com', // same domain, should reuse cached DNS
      'invalid-email',
    ];

    const results = await validateEmailBatch(emails, mockFetch as any);
    expect(results.size).toBe(4);
    expect(results.get('a@test.com')?.status).toBe('valid');
    expect(results.get('invalid-email')?.status).toBe('invalid_format');
    // Only 1 fetch for test.com MX because of caching
    expect(fetchCount).toBe(1);
  });
});
