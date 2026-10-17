/**
 * Local-calendar date helpers.
 *
 * All keys are local dates formatted as 'YYYY-MM-DD'. We deliberately avoid
 * `Date.prototype.toISOString()` for keys, because it converts to UTC and can
 * shift the date for users west/near UTC boundaries (e.g. IST-4 apps at night).
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Format any Date into a local 'YYYY-MM-DD' key. */
export function localDateKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse 'YYYY-MM-DD' into a local Date (midnight). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Accepts 'YYYY-MM-DD' (padded) and calendar-valid only. */
export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function shiftDateKey(key: string, days: number): string {
  return localDateKey(addDays(parseDateKey(key), days));
}

/** JS getDay() for a date key: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: string): number {
  return parseDateKey(key).getDay();
}

/** Inclusive range of date keys, oldest -> newest. */
export function rangeKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cursor = parseDateKey(fromKey);
  const end = parseDateKey(toKey);
  let guard = 0;
  while (cursor <= end && guard < 5000) {
    out.push(localDateKey(cursor));
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

export function lastNDays(endKey: string, n: number): string[] {
  const end = parseDateKey(endKey);
  const start = addDays(end, -(n - 1));
  return rangeKeys(localDateKey(start), endKey);
}

/**
 * First day of the (partial) week a date belongs to, honoring `weekStart`.
 * Returns a date key.
 */
export function startOfWeekKey(key: string, weekStart: 'sun' | 'mon'): string {
  const date = parseDateKey(key);
  const offset = weekStart === 'mon' ? (date.getDay() + 6) % 7 : date.getDay();
  return localDateKey(addDays(date, -offset));
}

/** Ordered weekday labels for a week-start preference. */
export function weekdayOrder(weekStart: 'sun' | 'mon'): number[] {
  return weekStart === 'mon' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

export function weekdayShort(weekday: number): string {
  return WEEKDAYS_SHORT[weekday] ?? '';
}

export function weekdayLong(weekday: number): string {
  return WEEKDAYS_LONG[weekday] ?? '';
}

/** Friendly display, e.g. 'Wednesday, Oct 15' */
export function formatDateLabel(key: string): string {
  const date = parseDateKey(key);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function monthName(month: number): string {
  return MONTHS[month] ?? '';
}

export function monthLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 'HH:MM' -> { hour, minute }, or null when invalid (24h). */
export function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
}
