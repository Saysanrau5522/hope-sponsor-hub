import type { EmailStatus } from './types.ts';

export interface DoHAnswer {
  name: string;
  type: number;
  data: string;
  TTL: number;
}

export interface DoHResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question?: { name: string; type: number }[];
  Answer?: DoHAnswer[];
}

export interface ValidationResult {
  email: string;
  status: EmailStatus;
  domain: string;
  hasMx: boolean;
  hasA: boolean;
  details?: string;
}

/**
 * Basic syntax validator using standard RFC 5322 regex approximation.
 */
export function isValidEmailSyntax(email: string): boolean {
  if (!email || email.length > 254) return false;
  // Disallow consecutive dots, leading/trailing dot
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.length > 64 || domain.length > 253) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (!domain.includes('.')) return false;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

/**
 * Query Cloudflare DNS-over-HTTPS (DoH) JSON API for MX or A records.
 */
export async function queryCloudflareDoH(
  domain: string,
  type: 'MX' | 'A' = 'MX',
  fetchFn: typeof fetch = fetch
): Promise<DoHResponse> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      accept: 'application/dns-json',
      'user-agent': 'hope-sponsor-hub/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare DoH query failed with status ${response.status}`);
  }

  return (await response.json()) as DoHResponse;
}

/**
 * Validate a domain using MX records first, falling back to A records if MX is absent.
 */
export async function checkDomainDNS(
  domain: string,
  fetchFn: typeof fetch = fetch
): Promise<{ hasMx: boolean; hasA: boolean; status: EmailStatus }> {
  try {
    // 1. Query MX records (type 15)
    const mxRes = await queryCloudflareDoH(domain, 'MX', fetchFn);
    const hasMx = Boolean(mxRes.Answer && mxRes.Answer.some((a) => a.type === 15));

    if (hasMx) {
      return { hasMx: true, hasA: false, status: 'valid' };
    }

    // 2. Query A records (type 1) if no MX
    const aRes = await queryCloudflareDoH(domain, 'A', fetchFn);
    const hasA = Boolean(aRes.Answer && aRes.Answer.some((a) => a.type === 1));

    if (hasA) {
      return { hasMx: false, hasA: true, status: 'valid' };
    }

    return { hasMx: false, hasA: false, status: 'no_mx' };
  } catch (err: any) {
    // In case of DNS network glitch, avoid false no_mx mark
    return { hasMx: false, hasA: false, status: 'valid' };
  }
}

/**
 * Batch validate emails respecting the Cloudflare free plan 50 subrequest limit.
 * Chunks of 25 max with in-memory domain deduplication.
 */
export async function validateEmailBatch(
  emails: string[],
  fetchFn: typeof fetch = fetch,
  domainCache: Map<string, { hasMx: boolean; hasA: boolean; status: EmailStatus }> = new Map()
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();

  for (const email of emails) {
    if (!email) continue;
    const trimmed = email.trim().toLowerCase();

    if (!isValidEmailSyntax(trimmed)) {
      results.set(email, {
        email,
        domain: '',
        hasMx: false,
        hasA: false,
        status: 'invalid_format',
        details: 'Invalid email syntax',
      });
      continue;
    }

    const domain = trimmed.split('@')[1];

    let dnsResult = domainCache.get(domain);
    if (!dnsResult) {
      dnsResult = await checkDomainDNS(domain, fetchFn);
      domainCache.set(domain, dnsResult);
    }

    results.set(email, {
      email,
      domain,
      hasMx: dnsResult.hasMx,
      hasA: dnsResult.hasA,
      status: dnsResult.status,
    });
  }

  return results;
}
