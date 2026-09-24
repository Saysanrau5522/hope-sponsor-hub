import { Context, Next } from 'hono';
import { importJWK, jwtVerify, decodeProtectedHeader, decodeJwt } from 'jose';
import { AuthUser } from '../../shared/types';

// In-memory isolate cache for Cloudflare Access JWKS public keys
let cachedJWKS: { keys: any[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface WorkerEnv {
  DB: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ALLOWED_EMAILS?: string;
  SEND_ENABLED?: string;
  DRY_RUN?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REDIRECT_URI?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  PIXEL_HOST?: string;
}

/**
 * Fetch and cache Cloudflare Access public keys (JWKS)
 */
async function getJWKS(teamDomain: string): Promise<any[]> {
  const now = Date.now();
  if (cachedJWKS && now - cachedJWKS.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cachedJWKS.keys;
  }

  const cleanDomain = teamDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const jwksUrl = `https://${cleanDomain}/cdn-cgi/access/certs`;

  const resp = await fetch(jwksUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Cloudflare Access JWKS from ${jwksUrl}: ${resp.status}`);
  }

  const data = (await resp.json()) as { keys: any[] };
  cachedJWKS = {
    keys: data.keys,
    fetchedAt: now,
  };

  return data.keys;
}

/**
 * Cloudflare Access Identity Middleware
 */
export async function accessAuthMiddleware(c: Context<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>, next: Next) {
  const jwtAssertion = c.req.header('Cf-Access-Jwt-Assertion');
  const allowedEmailsStr = c.env.ALLOWED_EMAILS || 'hopebyssi@gmail.com,saysanrau@gmail.com,tinethran@gmail.com';
  const allowedEmails = new Set(
    allowedEmailsStr.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );

  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const expectedAud = c.env.CF_ACCESS_AUD;
  const isDev = c.env.ENVIRONMENT === 'development' || !teamDomain || !expectedAud;

  // Local development fallback when not protected by live Cloudflare Access
  if (!jwtAssertion) {
    if (isDev) {
      // In dev mode, identify as team lead or use header override if supplied
      const devEmail = c.req.header('X-Dev-User-Email') || 'hopebyssi@gmail.com';
      c.set('user', {
        email: devEmail,
        name: 'HOPE Team Member (Dev)',
        role: 'admin',
      });
      return await next();
    }

    return c.json({ error: 'Missing Cloudflare Access JWT Assertion header' }, 401);
  }

  try {
    // Verify JWT
    const protectedHeader = decodeProtectedHeader(jwtAssertion);
    const kid = protectedHeader.kid;
    if (!kid) {
      return c.json({ error: 'Invalid JWT: missing kid in header' }, 401);
    }

    const keys = await getJWKS(teamDomain!);
    const matchingKey = keys.find((k) => k.kid === kid);
    if (!matchingKey) {
      return c.json({ error: 'Key ID not found in Cloudflare Access JWKS' }, 401);
    }

    const publicKey = await importJWK(matchingKey, matchingKey.alg || 'RS256');
    const { payload } = await jwtVerify(jwtAssertion, publicKey, {
      audience: expectedAud,
    });

    const userEmail = ((payload.email as string) || (c.req.header('Cf-Access-Authenticated-User-Email') as string) || '')
      .trim()
      .toLowerCase();

    if (!userEmail) {
      return c.json({ error: 'No email found in Cloudflare Access token' }, 403);
    }

    if (allowedEmails.size > 0 && !allowedEmails.has(userEmail)) {
      return c.json({ error: `User ${userEmail} is not in the authorized team allowlist` }, 403);
    }

    c.set('user', {
      email: userEmail,
      name: (payload.name as string) || userEmail,
      role: 'admin',
    });

    return await next();
  } catch (err: any) {
    console.error('Access verification error:', err);
    return c.json({ error: `Cloudflare Access authentication failed: ${err.message}` }, 401);
  }
}
