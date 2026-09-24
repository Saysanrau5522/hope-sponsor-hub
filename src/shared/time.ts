/**
 * Time and Date utilities for HOPE Sponsor Hub
 * All business dates, send windows, and letter dates run in Asia/Kuala_Lumpur (UTC+8).
 */

export const MYT_TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Format a Date object into uppercase letter date format in MYT.
 * Example: "27 SEPTEMBER 2026"
 */
export function formatLetterDateMYT(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: MYT_TIMEZONE,
  });
  return formatter.format(date).toUpperCase();
}

/**
 * Returns current timestamp as UTC ISO string.
 */
export function nowUTCISO(): string {
  return new Date().toISOString();
}

/**
 * Get date parts in MYT for calculations (year, month, day, hour, minute, dayOfWeek)
 */
export function getMYTParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dateString: string; // YYYY-MM-DD
} {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: MYT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  // Derive day of week for that specific MYT day
  // Since MYT is UTC+8, UTC midnight of YYYY-MM-DD corresponds to MYT 08:00
  const mytDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayOfWeek = mytDate.getUTCDay();
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    dateString,
  };
}

/**
 * Check if the given date falls inside the send window:
 * Mon-Fri, 09:00 - 16:30 MYT
 */
export function isInsideSendWindowMYT(
  date: Date = new Date(),
  startHour = 9,
  startMinute = 0,
  endHour = 16,
  endMinute = 30
): boolean {
  const parts = getMYTParts(date);

  // Check weekday (1 = Mon .. 5 = Fri)
  if (parts.dayOfWeek < 1 || parts.dayOfWeek > 5) {
    return false;
  }

  const currentMinutes = parts.hour * 60 + parts.minute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Calculate difference in calendar days in MYT between two dates.
 */
export function calendarDaysDiffMYT(earlier: Date, later: Date): number {
  const pEarlier = getMYTParts(earlier);
  const pLater = getMYTParts(later);

  const utc1 = Date.UTC(pEarlier.year, pEarlier.month - 1, pEarlier.day);
  const utc2 = Date.UTC(pLater.year, pLater.month - 1, pLater.day);

  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}
