import type {
  Completions,
  Habit,
  Weekday,
} from './types';
import {
  addDays,
  diffDateKeys,
  weekdayOf,
} from './date';

/**
 * Pure habit domain logic. No React, no storage, no notifications.
 *
 * ── COMPLETION RULES ────────────────────────────────────────────────────────
 * • A *scheduled day* for a habit is a local date ≥ habit.createdAt that:
 *     - matches the schedule: 'daily' → every day;
 *       'weekdays' → weekday ∈ habit.frequency.days, OR
 *     - the habit is not archived-yet-or-past for that day (an archived habit
 *       keeps its history, but days after `archivedAt` are no longer its
 *       responsibility — see `isDayScheduled`).
 * • A habit-day is *completed* when count(habit, date) ≥ effectiveTarget(habit).
 * • count(habit, date) is stored in a keyed map so multiple records for the
 *   same (habit, date) are structurally impossible. Unchecking deletes the
 *   date entry entirely, leaving no ghost records.
 *
 * ── STREAK RULES (documented, test-covered) ────────────────────────────────
 * • A streak is a run of consecutive *completed scheduled days*.
 * • Unscheduled days (weekday habits on off-days) neither count nor break.
 * • A scheduled day with no completion (count < target) BREAKS the streak —
 *   except *today*: an incomplete, scheduled, non-future "today" does not
 *   break the current streak (the day is still in progress — "grace rule").
 * • The current streak counts back from today (with the grace rule above).
 * • The longest streak is the maximum run between the first scheduled day
 *   (≥ createdAt) and the last scheduled day ≤ today. Future days are never
 *   counted toward anything.
 * • Streaks never include days before the habit existed (≥ createdAt), and a
 *   habit archived on day X never breaks/credits days after X.
 */

/** Default + clamp for the daily target. 1 means a plain "checkbox" habit. */
export function effectiveTarget(habit: Habit): number {
  const n = habit.target;
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 50) : 1;
}

export function scheduledWeekdays(habit: Habit): Weekday[] {
  return habit.frequency.type === 'daily'
    ? [0, 1, 2, 3, 4, 5, 6]
    : habit.frequency.days;
}

/**
 * Was this habit expected on `dateKey`?
 * • Never before the habit existed (≥ createdAt).
 * • For archived habits, never after their archive date (history frozen —
 *   days after `archivedAt` are neither scheduled nor counted).
 */
export function isDayScheduled(habit: Habit, dateKey: string): boolean {
  if (diffDateKeys(habit.createdAt, dateKey) < 0) return false;
  if (habit.archived && habit.archivedAt && diffDateKeys(habit.archivedAt, dateKey) < 0) return false;
  return scheduledWeekdays(habit).includes(weekdayOf(dateKey));
}

export function countFor(
  completions: Completions,
  habitId: string,
  dateKey: string,
): number {
  return completions[habitId]?.[dateKey]?.count ?? 0;
}

export function isDayComplete(
  habit: Habit,
  completions: Completions,
  dateKey: string,
): boolean {
  return countFor(completions, habit.id, dateKey) >= effectiveTarget(habit);
}

/** The last day that can still credit/break this habit's streaks. */
export function streakDeadline(habit: Habit, today: string): string {
  return habit.archived && habit.archivedAt && diffDateKeys(habit.archivedAt, today) < 0
    ? habit.archivedAt
    : today;
}

export function currentStreak(
  habit: Habit,
  completions: Completions,
  today: string,
): number {
  let streak = 0;
  let cursor = streakDeadline(habit, today);
  // Hard safety bound: walk at most from the habit's creation date.
  const earliest = habit.createdAt;
  while (diffDateKeys(earliest, cursor) >= 0) {
    const scheduled = isDayScheduled(habit, cursor);
    if (scheduled) {
      const complete = isDayComplete(habit, completions, cursor);
      if (complete) {
        streak += 1;
      } else if (cursor === today) {
        // Grace rule: an in-progress today does not break the streak yet.
        // Fall through to yesterday without counting it.
      } else {
        break; // missed scheduled day → streak ends here
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(
  habit: Habit,
  completions: Completions,
  today: string,
): number {
  const byHabit = completions[habit.id] ?? {};
  const target = effectiveTarget(habit);
  const deadline = streakDeadline(habit, today);
  const completedKeys = Object.keys(byHabit)
    .filter(
      (key) =>
        (byHabit[key]?.count ?? 0) >= target &&
        diffDateKeys(key, deadline) <= 0 &&
        isDayScheduled(habit, key),
    )
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of completedKeys) {
    run = prev !== null && diffDateKeys(prev, key) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

/**
 * Toggle state machine for a single tap on a habit-day check button.
 * Returns the new count for (habit, date).
 *   count === 0           → tap sets it to `target` (complete)
 *   0 < count < target    → tap completes it (target)
 *   count === target      → tap resets it to 0 (uncheck)
 * The caller persists `0` by deleting the date entry.
 */
export function nextCountAfterToggle(habit: Habit, currentCount: number): number {
  const target = effectiveTarget(habit);
  if (currentCount >= target) return 0;
  return target;
}

/** Increment one step for "+1" taps on multi-target habits. */
export function nextCountAfterIncrement(habit: Habit, currentCount: number): number {
  const target = effectiveTarget(habit);
  return Math.min(currentCount + 1, target);
}

/**
 * Global streak: consecutive local days (walking back from today, grace rule
 * applies to today) where EVERY scheduled habit was completed. Useful for the
 * dashboard headline. Sourced from active habits only.
 */
export function globalStreak(
  habits: Habit[],
  completions: Completions,
  today: string,
): number {
  const active = habits.filter((h) => !h.archived);
  if (active.length === 0) return 0;
  const earliest = active.reduce(
    (min, h) => (diffDateKeys(min, h.createdAt) > 0 ? h.createdAt : min),
    today,
  );
  let streak = 0;
  let cursor = today;
  while (diffDateKeys(earliest, cursor) >= 0) {
    const scheduledToday = active.filter((h) => isDayScheduled(h, cursor));
    if (scheduledToday.length > 0) {
      const allDone = scheduledToday.every((h) => isDayComplete(h, completions, cursor));
      if (allDone) {
        streak += 1;
      } else if (cursor === today) {
        // grace: today still in progress
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Highest consecutive day count between a stored set of per-habit stats. */
export function bestCurrentStreak(habits: Habit[], completions: Completions, today: string): number {
  return habits.reduce(
    (max, h) => Math.max(max, currentStreak(h, completions, today)),
    0,
  );
}

/** 'HH:MM' (current) or { hour, minute } (legacy) → 24h clock, or null. */
export function reminderClock(reminder?: Habit['reminder']): { hour: number; minute: number } | null {
  if (!reminder) return null;
  if (typeof reminder.time === 'string') {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(reminder.time.trim());
    return match ? { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) } : null;
  }
  if (typeof reminder.hour === 'number' && typeof reminder.minute === 'number') {
    return { hour: reminder.hour, minute: reminder.minute };
  }
  return null;
}

/** Precise trigger count for a habit's reminder schedule. */
export function reminderTriggerCount(habit: Habit): number {
  if (habit.reminder === null) return 0;
  return habit.frequency.type === 'daily' ? 1 : Math.max(habit.frequency.days.length, 0);
}

