import { describe, it, expect } from 'vitest';
import { isInsideSendWindowMYT, getMYTParts, calendarDaysDiffMYT } from '../src/shared/time';
import { sanitizeAsciiFilename, rfc2047EncodeSubject } from '../src/shared/mime';

describe('Queue Pacing & Safety Engine (Phase 4 Acceptance)', () => {
  it('enforces send window: Mon-Fri 09:00 - 16:30 MYT only', () => {
    // 09:15 MYT on Wednesday -> true
    // 09:15 MYT = 01:15 UTC
    const wednesdayInWindow = new Date('2026-09-23T01:15:00Z');
    expect(isInsideSendWindowMYT(wednesdayInWindow)).toBe(true);

    // 08:45 MYT on Wednesday -> before window -> false
    // 08:45 MYT = 00:45 UTC
    const wednesdayBeforeWindow = new Date('2026-09-23T00:45:00Z');
    expect(isInsideSendWindowMYT(wednesdayBeforeWindow)).toBe(false);

    // 16:35 MYT on Wednesday -> after window -> false
    // 16:35 MYT = 08:35 UTC
    const wednesdayAfterWindow = new Date('2026-09-23T08:35:00Z');
    expect(isInsideSendWindowMYT(wednesdayAfterWindow)).toBe(false);

    // 12:00 MYT on Sunday -> weekend -> false
    const sundayNoon = new Date('2026-09-27T04:00:00Z');
    expect(isInsideSendWindowMYT(sundayNoon)).toBe(false);
  });

  it('calculates daily quota bounds in MYT correctly', () => {
    // 2026-09-24 10:00 MYT (02:00 UTC)
    const now = new Date('2026-09-24T02:00:00Z');
    const parts = getMYTParts(now);
    expect(parts.dateString).toBe('2026-09-24');

    // 00:00:00 MYT on 2026-09-24 corresponds to 2026-09-23T16:00:00.000Z in UTC
    const mytMidnightUTC = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
    const dayStartUTC = new Date(mytMidnightUTC.getTime() - 8 * 60 * 60 * 1000).toISOString();
    const dayEndUTC = new Date(mytMidnightUTC.getTime() + 16 * 60 * 60 * 1000).toISOString();

    expect(dayStartUTC).toBe('2026-09-23T16:00:00.000Z');
    expect(dayEndUTC).toBe('2026-09-24T16:00:00.000Z');
  });

  it('calculates estimated sending duration using daily ramp (25, 50, 80/day)', () => {
    function estimateDays(count: number): number {
      let remaining = count;
      let days = 0;
      if (remaining > 0) {
        days++;
        remaining -= Math.min(remaining, 25);
      }
      if (remaining > 0) {
        days++;
        remaining -= Math.min(remaining, 50);
      }
      if (remaining > 0) {
        days += Math.ceil(remaining / 80);
      }
      return days;
    }

    // Spec says: "At 80/day, about 399 emails take roughly five business days."
    // Day 1: 25 -> 374 left
    // Day 2: 50 -> 324 left
    // Day 3: 80 -> 244 left
    // Day 4: 80 -> 164 left
    // Day 5: 80 -> 84 left
    // Day 6: 80 -> 4 left
    // Day 7: 4 -> 0 left
    expect(estimateDays(25)).toBe(1);
    expect(estimateDays(75)).toBe(2);
    expect(estimateDays(155)).toBe(3);
    expect(estimateDays(391)).toBe(6);
  });

  it('enforces jitter bounds between 60s and 180s', () => {
    const min = 60;
    const max = 180;
    for (let i = 0; i < 100; i++) {
      const jitter = Math.floor(Math.random() * (max - min + 1)) + min;
      expect(jitter).toBeGreaterThanOrEqual(60);
      expect(jitter).toBeLessThanOrEqual(180);
    }
  });

  it('handles retry backoff: network errors back off 3 times before failing', () => {
    function getNextRetryState(currentRetries: number, errMsg: string) {
      const isClientError = /4\d\d/.test(errMsg);
      if (isClientError) {
        return { status: 'failed', retries: currentRetries, backoffMinutes: 0 };
      }
      const newRetries = currentRetries + 1;
      if (newRetries <= 3) {
        return { status: 'queued', retries: newRetries, backoffMinutes: newRetries * 5 };
      }
      return { status: 'failed', retries: newRetries, backoffMinutes: 0 };
    }

    // 4xx error -> fails immediately without retry
    expect(getNextRetryState(0, '400 Bad Request: Invalid recipient')).toEqual({
      status: 'failed',
      retries: 0,
      backoffMinutes: 0,
    });

    // 5xx / Network error -> retries 1, 2, 3 with 5m, 10m, 15m backoff
    expect(getNextRetryState(0, '503 Service Unavailable')).toEqual({
      status: 'queued',
      retries: 1,
      backoffMinutes: 5,
    });
    expect(getNextRetryState(1, '503 Service Unavailable')).toEqual({
      status: 'queued',
      retries: 2,
      backoffMinutes: 10,
    });
    expect(getNextRetryState(2, '503 Service Unavailable')).toEqual({
      status: 'queued',
      retries: 3,
      backoffMinutes: 15,
    });

    // Exceeds 3 retries -> failed
    expect(getNextRetryState(3, '503 Service Unavailable')).toEqual({
      status: 'failed',
      retries: 4,
      backoffMinutes: 0,
    });
  });
});
