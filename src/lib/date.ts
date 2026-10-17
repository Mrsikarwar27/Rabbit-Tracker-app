import type { Weekday } from './types';

/**
 * Local-calendar date helpers.
 *
 * Golden rule: a "date key" is always `YYYY-MM-DD` built from the *local*
 * clock components (getFullYear/getMonth/getDate). We never run a local
 * midnight through `toISOString()`, because that converts to UTC and shifts
 * the day for users in IST (+05:30) between 00:00 and 05:30.
 */

const MS_PER_DAY = 86_400_000;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Local Date -> 'YYYY-MM-DD'. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (!Number.isFinite(y) || y < 1 || y > 9999 || m < 1 || m > 12 || day < 1 || day > 31) {
    throw new Error(`toLocalDateKey: invalid date ${d.toISOString()}`);
  }
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/** Current local date key. */
export function todayKey(): string {
  return toLocalDateKey(new Date());
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True if the string has date-key shape. */
export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

/**
 * 'YYYY-MM-DD' -> Date at local midnight. Returns null for invalid keys.
 * Does not round-trip through UTC.
 */
export function parseDateKey(key: string): Date | null {
  if (!isDateKey(key)) return null;
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null; // e.g. 2024-02-31 rolled over
  }
  return date;
}

function validateKey(key: string): Date {
  const d = parseDateKey(key);
  if (!d) throw new Error(`Invalid date key: ${key}`);
  return d;
}

/** Whole calendar days from a to b (b - a). Independent of DST gaps. */
export function diffDateKeys(a: string, b: string): number {
  const da = validateKey(a);
  const db = validateKey(b);
  da.setMinutes(da.getMinutes() - da.getTimezoneOffset());
  db.setMinutes(db.getMinutes() - db.getTimezoneOffset());
  return Math.round((db.getTime() - da.getTime()) / MS_PER_DAY);
}

/** date key + n days. */
export function addDays(key: string, n: number): string {
  const d = validateKey(key);
  d.setDate(d.getDate() + n);
  return toLocalDateKey(d);
}

export function weekdayOf(key: string): Weekday {
  return validateKey(key).getDay() as Weekday;
}

export function monthOf(key: string): { year: number; month: number } {
  const d = validateKey(key);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Local midnight of the month of a date key, plus a day offset within it. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1, 0, 0, 0, 0);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Key of the first day of the ISO-ish week containing `key`, given weekStart. */
export function beginOfWeek(key: string, weekStart: Weekday): string {
  const wd = weekdayOf(key);
  const back = (wd - weekStart + 7) % 7;
  return addDays(key, -back);
}

/** Ordered date keys of the week containing `key`. */
export function weekKeys(key: string, weekStart: Weekday): string[] {
  const start = beginOfWeek(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Ordered weekday numbers (0–6) for the header row, given weekStart. */
export function weekHeaderWeekdays(weekStart: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStart + i) % 7) as Weekday);
}

/**
 * Weeks of date keys for a whole month grid.
 * Leading/trailing cells fall outside the month (they carry real date keys).
 */
export function monthGrid(
  year: number,
  month: number,
  weekStart: Weekday,
): string[][] {
  const first = `${year}-${pad2(month)}-01`;
  const begin = beginOfWeek(first, weekStart);
  const totalDays = daysInMonth(year, month);
  const cells = Math.ceil((totalDays + diffDateKeys(begin, first)) / 7) * 7;
  const rows: string[][] = [];
  for (let r = 0; r < cells / 7; r += 1) {
    rows.push(
      Array.from({ length: 7 }, (_, c) => addDays(begin, r * 7 + c)),
    );
  }
  return rows;
}

export function isInMonth(key: string, year: number, month: number): boolean {
  const m = monthOf(key);
  return m.year === year && m.month === month;
}

/** 'Sat 15 Oct 2026'-style long local date. */
export function formatLongDate(key: string): string {
  const d = validateKey(key);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** '15 Oct'-style short local date. */
export function formatShortDate(key: string): string {
  const d = validateKey(key);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** 'October 2026' month title. */
export function formatMonthTitle(year: number, month: number): string {
  const d = new Date(year, month - 1, 1, 0, 0, 0, 0);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** 'h:mm am/pm' reminder label from 24h time. */
export function formatTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad2(minute)} ${suffix}`;
}

/** True when key equals today. */
export function isToday(key: string): boolean {
  return key === todayKey();
}

/** True when key is strictly in the future relative to today. */
export function isFutureDate(key: string): boolean {
  return diffDateKeys(todayKey(), key) > 0;
}

/** Inclusive list of date keys. Caller must keep ranges small. */
export function rangeKeys(from: string, to: string): string[] {
  const span = diffDateKeys(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(from, i));
}
