import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, generateTrackingToken } from '../src/shared/crypto';

describe('Cryptographic Helpers (AES-GCM 256-bit)', () => {
  const secretKey = '32_byte_secret_key_test_super_secure!';

  it('encrypts and decrypts refresh tokens accurately', async () => {
    const originalToken = '1//04test_google_refresh_token_xyz_1234567890';
    const encrypted = await encryptToken(originalToken, secretKey);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.length).toBeGreaterThan(32);

    const decrypted = await decryptToken(encrypted, secretKey);
    expect(decrypted).toBe(originalToken);
  });

  it('fails decryption with wrong secret key', async () => {
    const originalToken = 'secret_token';
    const encrypted = await encryptToken(originalToken, secretKey);

    await expect(decryptToken(encrypted, 'wrong_key_that_does_not_match_32_bytes')).rejects.toThrow();
  });

  it('generates unguessable 48-character hex tracking tokens', () => {
    const token1 = generateTrackingToken();
    const token2 = generateTrackingToken();

    expect(token1).toHaveLength(48);
    expect(token2).toHaveLength(48);
    expect(token1).not.toBe(token2);
    expect(/^[a-f0-9]{48}$/.test(token1)).toBe(true);
  });
});
