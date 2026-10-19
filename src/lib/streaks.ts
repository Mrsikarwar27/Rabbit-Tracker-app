/**
 * Streak & scheduling rules (single source of truth for the whole app):
 *
 * 1. A day is "scheduled" for a habit when the habit's frequency includes it
 *    (daily = every day, weekdays = only the selected weekdays).
 * 2. A scheduled day is "completed" when a completion record exists for that
 *    (habit, date) pair with count >= habit.target.
 * 3. CURRENT STREAK: the number of consecutive scheduled+completed days
 *    scanning backwards from today, with two daily-life adjustments:
 *      - Today is "pending": if today is scheduled but not yet completed, we
 *        skip today rather than break the streak (the day isn't over yet).
 *      - The habit's own creation date marks the earliest day that could
 *        count (earlier days are never scheduled).
 *    Scanning stops at the first scheduled day (strictly before today) that
 *    was NOT completed — a missed scheduled day breaks the streak.
 * 4. LONGEST STREAK: the longest run of scheduled+completed days between the
 *    habit's creation date and today. Historical (past) scheduled days that
 *    were not completed always break a run; an uncompleted *today* merely
 *    ends the current run without invalidating the maximum.
 * 5. Archived habits keep their computed streaks from their stored history,
 *    but are excluded from dashboard aggregates while archived.
 * 6. Completion records: exactly one record per (habit, date); unchecking
 *    sets count to 0 on that record (history is preserved, never duplicated).
 */

import type { CompletionMap, Habit, Weekday } from './types';
import { localDateKey, parseDateKey, shiftDateKey } from './dates';

/** True when the habit is scheduled on the given date key. */
export function isScheduledOn(habit: Habit, dateKey: string): boolean {
  if (habit.frequency.type === 'daily') return true;
  if (habit.frequency.type === 'weekdays') {
    return habit.frequency.days.includes(parseDateKey(dateKey).getDay() as Weekday);
  }
  return false;
}

export function isCompletedOn(
  habit: Habit,
  completions: CompletionMap,
  dateKey: string,
): boolean {
  const record = completions[dateKey]?.[habit.id];
  return !!record && record.count >= habit.target;
}

export function completionCountOn(
  habit: Habit,
  completions: CompletionMap,
  dateKey: string,
): number {
  return completions[dateKey]?.[habit.id]?.count ?? 0;
}

/** Date key the habit could first have been scheduled (local, from createdAt). */
function createdAtKey(habit: Habit): string {
  const created = new Date(habit.createdAt);
  if (Number.isNaN(created.getTime())) return localDateKey();
  return localDateKey(created);
}

export function currentStreak(habit: Habit, completions: CompletionMap, todayKey: string): number {
  let cursor = todayKey;
  let streak = 0;
  let guard = 0;

  while (guard < 7300) {
    guard += 1;
    if (cursor < createdAtKey(habit)) break;

    const scheduled = isScheduledOn(habit, cursor);
    const completed = isCompletedOn(habit, completions, cursor);

    if (completed) {
      streak += 1;
      cursor = shiftDateKey(cursor, -1);
      continue;
    }

    // Today not completed yet => pending, skip without breaking.
    if (cursor === todayKey) {
      cursor = shiftDateKey(cursor, -1);
      continue;
    }

    // A scheduled, strictly-past day that was missed breaks the streak.
    if (scheduled) break;

    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit, completions: CompletionMap, todayKey: string): number {
  if (todayKey < createdAtKey(habit)) return 0;
  let cursor = createdAtKey(habit);
  let best = 0;
  let run = 0;
  let guard = 0;

  while (cursor <= todayKey && guard < 7300) {
    guard += 1;
    const scheduled = isScheduledOn(habit, cursor);
    const completed = isCompletedOn(habit, completions, cursor);

    if (completed) {
      run += 1;
      best = Math.max(best, run);
    } else if (scheduled && cursor < todayKey) {
      // Historical missed scheduled day: run is dead. Today may still be pending.
      run = 0;
    }
    cursor = shiftDateKey(cursor, 1);
  }
  return best;
}
