import { describe, it, expect } from 'vitest';
import { classifyOpenHit } from '../src/pixel/index';

describe('Tracking Pixel Open Event Classification (Phase 3 Acceptance)', () => {
  const sentTimeISO = '2026-09-24T10:00:00.000Z';

  it('classifies hits within 2 minutes of sending as ignored_early', () => {
    // 30 seconds after send
    const hit30s = '2026-09-24T10:00:30.000Z';
    expect(classifyOpenHit(sentTimeISO, hit30s, null, false, false)).toBe('ignored_early');

    // 119 seconds after send
    const hit119s = '2026-09-24T10:01:59.000Z';
    expect(classifyOpenHit(sentTimeISO, hit119s, null, false, false)).toBe('ignored_early');
  });

  it('classifies hits from Apple Mail Privacy (ASN 714) as possible_prefetch', () => {
    // 5 minutes after send, but from Apple ASN 714
    const hit5m = '2026-09-24T10:05:00.000Z';
    expect(classifyOpenHit(sentTimeISO, hit5m, 714, false, false)).toBe('possible_prefetch');
  });

  it('classifies repeated hits in the exact same second as possible_prefetch', () => {
    const hit5m = '2026-09-24T10:05:00.000Z';
    expect(classifyOpenHit(sentTimeISO, hit5m, null, true, false)).toBe('possible_prefetch');
  });

  it('classifies genuine human opens after 2 minutes as likely_human', () => {
    // 10 minutes after send, standard ISP
    const hit10m = '2026-09-24T10:10:00.000Z';
    expect(classifyOpenHit(sentTimeISO, hit10m, 4788, false, false)).toBe('likely_human');
  });
});
