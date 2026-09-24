import { describe, it, expect } from 'vitest';
import {
  formatLetterDateMYT,
  getMYTParts,
  isInsideSendWindowMYT,
  calendarDaysDiffMYT,
} from '../src/shared/time';

describe('Malaysia Time (MYT - UTC+8) Utilities', () => {
  it('formats letter date in uppercase en-GB style in MYT', () => {
    // 2026-09-27 12:00:00 UTC = 2026-09-27 20:00:00 MYT
    const date = new Date('2026-09-27T12:00:00Z');
    const formatted = formatLetterDateMYT(date);
    expect(formatted).toBe('27 SEPTEMBER 2026');
  });

  it('handles midnight boundary: 23:30 UTC on the 26th is 07:30 MYT on the 27th', () => {
    // Exact requirement from spec:
    // "23:30 UTC on the 26th is 07:30 MYT on the 27th, so the letter must say the 27th."
    const date = new Date('2026-09-26T23:30:00Z');
    const parts = getMYTParts(date);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(27);
    expect(parts.hour).toBe(7);
    expect(parts.minute).toBe(30);

    const formatted = formatLetterDateMYT(date);
    expect(formatted).toBe('27 SEPTEMBER 2026');
  });

  it('determines send window accurately (Mon-Fri 09:00 - 16:30 MYT)', () => {
    // Friday at 10:00 MYT -> inside window
    // 10:00 MYT = 02:00 UTC
    const insideFri = new Date('2026-09-25T02:00:00Z');
    expect(isInsideSendWindowMYT(insideFri)).toBe(true);

    // Friday at 16:45 MYT -> after window
    // 16:45 MYT = 08:45 UTC
    const afterFri = new Date('2026-09-25T08:45:00Z');
    expect(isInsideSendWindowMYT(afterFri)).toBe(false);

    // Saturday at 10:00 MYT -> weekend, outside window
    // 10:00 MYT = 02:00 UTC
    const saturday = new Date('2026-09-26T02:00:00Z');
    expect(isInsideSendWindowMYT(saturday)).toBe(false);

    // Sunday at 10:00 MYT -> weekend, outside window
    const sunday = new Date('2026-09-27T02:00:00Z');
    expect(isInsideSendWindowMYT(sunday)).toBe(false);
  });

  it('calculates calendar days difference in MYT', () => {
    const sent = new Date('2026-09-17T02:00:00Z'); // 17 Sept MYT
    const now = new Date('2026-09-24T02:00:00Z');  // 24 Sept MYT
    expect(calendarDaysDiffMYT(sent, now)).toBe(7);
  });
});
