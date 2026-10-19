import type { Completions, Habit, CompletionMap } from './types';
import { addDays, beginOfWeek, weekdayOf } from './date';
import { daysInMonth, monthName } from './dates';
import {
  currentStreak,
  effectiveTarget,
  isDayComplete,
  isDayScheduled,
  longestStreak,
  countFor,
} from './habit-logic';
import { isCompletedOn, isScheduledOn } from './streaks';

/**
 * Pure analytics. Nothing here renders; screens memorize these results.
 * Empty datasets always produce well-defined zeros/nulls — never crashes,
 * never invented statistics.
 */

export interface DayProgress {
  day: string;
  scheduled: number;
  done: number;
  ratio: number; // 0..1; scheduled === 0 → 0
}

/** Progress of a single local day over the given habit set. */
export function dayProgress(
  habits: Habit[],
  completions: Completions,
  day: string,
): DayProgress {
  const visible = habits.filter((h) => isDayScheduled(h, day));
  const done = visible.filter((h) => isDayComplete(h, completions, day)).length;
  const scheduled = visible.length;
  return {
    day,
    scheduled,
    done,
    ratio: scheduled > 0 ? done / scheduled : 0,
  };
}

export interface SeriesPoint extends DayProgress {
  label: string;
}

/**
 * Per-day progress over the last `days` days, ending at `today`
 * (inclusive, oldest first).
 */
export function dayTrend(
  habits: Habit[],
  completions: Completions,
  today: string,
  days: number,
  label: (day: string, index: number) => string,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const p = dayProgress(habits, completions, day);
    points.push({ ...p, label: label(day, days - 1 - i) });
  }
  return points;
}

export interface WeekSummary {
  start: string;
  end: string;
  scheduled: number;
  done: number;
  ratio: number;
}

/** Trailing `weeks` completed weeks + the in-progress current week. */
export function weekTrend(
  habits: Habit[],
  completions: Completions,
  today: string,
  weekStart: 0 | 1,
  weeks: number,
): WeekSummary[] {
  const out: WeekSummary[] = [];
  const thisWeekStart = beginOfWeek(today, weekStart);
  for (let i = 0; i < weeks; i += 1) {
    const start = addDays(thisWeekStart, -7 * i);
    const end = addDays(start, 6);
    let scheduled = 0;
    let done = 0;
    for (let d = 0; d < 7; d += 1) {
      const day = addDays(start, d);
      // Future days of the current week must not dilute the ratio.
      if (addDays(today, 0) < day) continue;
      for (const h of habits) {
        if (!isDayScheduled(h, day)) continue;
        scheduled += 1;
        if (isDayComplete(h, completions, day)) done += 1;
      }
    }
    out.push({
      start,
      end,
      scheduled,
      done,
      ratio: scheduled > 0 ? done / scheduled : 0,
    });
  }
  return out.reverse();
}

export interface MonthSummary {
  year: number;
  month: number;
  scheduled: number;
  done: number;
  ratio: number;
  days: DayProgress[]; // one entry per day of the month
}

/** Current- (or arbitrary-) month summary incl. per-day cells. */
export function monthSummary(
  habits: Habit[],
  completions: Completions,
  year: number,
  month: number,
  today: string,
): MonthSummary {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0);
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  const days: DayProgress[] = [];
  let scheduled = 0;
  let done = 0;
  let cursor = first;
  while (cursor <= lastKey) {
    const p = dayProgress(habits, completions, cursor);
    days.push(p);
    scheduled += p.scheduled;
    done += p.done;
    cursor = addDays(cursor, 1);
  }
  return {
    year,
    month,
    scheduled,
    done,
    ratio: scheduled > 0 ? done / scheduled : 0,
    days,
  };
}

export interface HabitStats {
  habit: Habit;
  done: number;
  scheduled: number;
  rate: number; // 0..1 over the trailing window
  currentStreak: number;
  longestStreak: number;
}

/** Per-habit performance over trailing `windowDays` days. */
export function perHabitStats(
  habits: Habit[],
  completions: Completions,
  today: string,
  windowDays: number,
): HabitStats[] {
  return habits
    .map((habit) => {
      let scheduled = 0;
      let done = 0;
      for (let i = 0; i < windowDays; i += 1) {
        const day = addDays(today, -i);
        // isDayScheduled already excludes days before createdAt and
        // everything after an archived habit's freeze date.
        if (!isDayScheduled(habit, day)) continue;
        scheduled += 1;
        if (isDayComplete(habit, completions, day)) done += 1;
      }
      return {
        habit,
        done,
        scheduled,
        rate: scheduled > 0 ? done / scheduled : 0,
        currentStreak: currentStreak(habit, completions, today),
        longestStreak: longestStreak(habit, completions, today),
      };
    })
    .sort((a, b) => b.rate - a.rate || b.currentStreak - a.currentStreak);
}

/** Total completed habit-days across ALL history (incl. deleted habits). */
export function totalCompleted(completions: Completions): number {
  let total = 0;
  for (const byDate of Object.values(completions)) {
    for (const entry of Object.values(byDate)) {
      if ((entry?.count ?? 0) >= 1) total += 1;
    }
  }
  return total;
}

/** Count of completions recorded today for quick display. */
export function totalCompletedToday(
  habits: Habit[],
  completions: Completions,
  today: string,
): number {
  let total = 0;
  for (const h of habits) {
    if (countFor(completions, h.id, today) >= effectiveTarget(h)) total += 1;
  }
  return total;
}

/** Monday=1 label helper for 7-day strips. */
export function weekdayLetter(day: string): string {
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][weekdayOf(day)];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Store-facing analytics.
 *
 * These build on the scheduling rules in `streaks.ts` (frequency + target),
 * rather than the legacy `habit-logic.ts` helpers above, because the habit
 * store persists `frequency.weekdays` and completion records keyed by date.
 *
 * Two invariants worth stating, since the screens depend on them:
 *   • Days after `todayKey` report scheduled === 0, so future days can never
 *     dilute a ratio (same rule the legacy weekTrend applies).
 *   • A habit-day counts as done at count >= habit.target; days with nothing
 *     scheduled yield rate 0 rather than NaN.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface DateRate {
  dateKey: string;
  scheduled: number;
  completed: number;
  /** 0..1 over scheduled habit-days; 0 when nothing was scheduled. */
  rate: number;
}

function rateOn(
  habits: Habit[],
  completions: CompletionMap,
  dateKey: string,
  todayKey: string,
): { scheduled: number; completed: number; rate: number } {
  if (dateKey > todayKey) return { scheduled: 0, completed: 0, rate: 0 };
  let scheduled = 0;
  let completed = 0;
  for (const habit of habits) {
    if (!isScheduledOn(habit, dateKey)) continue;
    scheduled += 1;
    if (isCompletedOn(habit, completions, dateKey)) completed += 1;
  }
  return { scheduled, completed, rate: scheduled > 0 ? completed / scheduled : 0 };
}

/** Single-day completion rate. */
export function rateForDate(
  habits: Habit[],
  completions: CompletionMap,
  dateKey: string,
): { scheduled: number; completed: number; rate: number } {
  // No "today" bound here: the caller supplies a concrete past date.
  return rateOn(habits, completions, dateKey, '9999-12-31');
}

/** Per-day rates for an explicit, oldest-first list of date keys. */
export function dayRates(
  habits: Habit[],
  completions: CompletionMap,
  dateKeys: string[],
  todayKey: string,
): DateRate[] {
  return dateKeys.map((dateKey) => ({ dateKey, ...rateOn(habits, completions, dateKey, todayKey) }));
}

export interface HabitRate {
  habit: Habit;
  scheduled: number;
  completed: number;
  rate: number;
}

/**
 * Per-habit performance over an explicit list of date keys, best first.
 * Habits with nothing scheduled in the window sink to the bottom.
 */
export function habitRatesOverDays(
  habits: Habit[],
  completions: CompletionMap,
  dateKeys: string[],
): HabitRate[] {
  const out: HabitRate[] = habits.map((habit) => {
    let scheduled = 0;
    let completed = 0;
    for (const dateKey of dateKeys) {
      if (!isScheduledOn(habit, dateKey)) continue;
      scheduled += 1;
      if (isCompletedOn(habit, completions, dateKey)) completed += 1;
    }
    return { habit, scheduled, completed, rate: scheduled > 0 ? completed / scheduled : 0 };
  });
  return out.sort(
    (a, b) => b.rate - a.rate || b.completed - a.completed || a.habit.title.localeCompare(b.habit.title),
  );
}

/** Every day of `month` (0-indexed) with its rate, oldest first. */
export function monthReport(
  habits: Habit[],
  completions: CompletionMap,
  year: number,
  month: number,
  todayKey: string,
): DateRate[] {
  const total = daysInMonth(year, month);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const cells: DateRate[] = [];
  for (let day = 1; day <= total; day += 1) {
    const dateKey = `${prefix}${String(day).padStart(2, '0')}`;
    cells.push({ dateKey, ...rateOn(habits, completions, dateKey, todayKey) });
  }
  return cells;
}

export interface MonthlySummary {
  /** Month name, e.g. 'October' — rendered as a section header. */
  label: string;
  scheduled: number;
  completed: number;
  rate: number;
  days: DateRate[];
}

/** Whole-month rollup including the per-day cells behind it. */
export function monthlySummary(
  habits: Habit[],
  completions: CompletionMap,
  year: number,
  month: number,
  todayKey: string,
): MonthlySummary {
  const days = monthReport(habits, completions, year, month, todayKey);
  let scheduled = 0;
  let completed = 0;
  for (const day of days) {
    scheduled += day.scheduled;
    completed += day.completed;
  }
  return {
    label: monthName(month),
    scheduled,
    completed,
    rate: scheduled > 0 ? completed / scheduled : 0,
    days,
  };
}

/**
 * Total completed habit-days across all recorded history for the given habits.
 *
 * Reads completion records directly rather than enumerating dates, so it stays
 * correct for habits whose window would otherwise be unbounded. Records for
 * habits outside `habits` (e.g. deleted ones) are ignored.
 */
export function totalHabitDays(habits: Habit[], completions: CompletionMap): number {
  const targets = new Map(habits.map((h) => [h.id, h.target ?? 1]));
  let total = 0;
  for (const byDate of Object.values(completions ?? {})) {
    for (const [habitId, entry] of Object.entries(byDate ?? {})) {
      const target = targets.get(habitId);
      if (target === undefined) continue;
      if ((entry?.count ?? 0) >= target) total += 1;
    }
  }
  return total;
}
