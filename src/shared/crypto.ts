/**
 * Cryptographic helpers for securing tokens with AES-GCM using Web Crypto API.
 */

function stringToKeyBytes(secret: string): Uint8Array {
  const enc = new TextEncoder();
  const bytes = enc.encode(secret);
  if (bytes.length >= 32) {
    return bytes.slice(0, 32);
  }
  // Zero-pad to 32 bytes if shorter
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return padded;
}

/**
 * Encrypt a plaintext string using AES-GCM 256-bit.
 * Returns a base64 string combining IV (12 bytes) and ciphertext.
 */
export async function encryptToken(plaintext: string, secretKey: string): Promise<string> {
  const keyBytes = stringToKeyBytes(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an AES-GCM encrypted base64 payload.
 */
export async function decryptToken(encryptedBase64: string, secretKey: string): Promise<string> {
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const keyBytes = stringToKeyBytes(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a cryptographically secure, unguessable random token for tracking.
 */
export function generateTrackingToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
