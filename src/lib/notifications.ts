import { Platform } from 'react-native';
import type { Habit } from './types';
import { makeId } from './storage';

/**
 * Local habit reminders.
 *
 * Platform reality (verified against expo-notifications ~57.0.23, Android
 * sources included):
 * • expo-notifications is Android/iOS only — on web nothing happens beyond a
 *   graceful no-op (this module never even evals the import there).
 * • There is NO remote push and NO backend: only scheduling.
 * • Android 12+ may deliver reminders as *inexact alarms* in Expo Go unless
 *   the SCHEDULE_EXACT_ALARM permission is granted — delivery can be several
 *   minutes late under Doze. We surface this to the user honestly.
 * • Android 15+ "restricted" notification settings can drop alarms entirely;
 *   if the OS reports that through the SCHEDulER the schedule call rejects,
 *   which we catch and surface via the returned status object.
 * • Permission denial never throws for the caller — we return a status.
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as NotificationsModule;
      cached.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      cached = null;
    }
  }
  return cached;
}

export const REMINDER_CHANNEL_ID = 'habit-reminders';

export interface PermissionResult {
  status: 'granted' | 'denied' | 'unavailable' | 'error';
}

export function remindersAvailable(): boolean {
  return Platform.OS !== 'web' && notifications() !== null;
}

export async function ensureChannel(): Promise<void> {
  const mod = notifications();
  if (!mod || Platform.OS !== 'android') return;
  try {
    await mod.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Habit reminders',
      importance: mod.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A6F36A',
    });
  } catch {
    // Channels are best-effort; scheduling still attempts afterward.
  }
}

/** Ask the OS for notification permission. Never throws. */
export async function requestReminderPermission(): Promise<PermissionResult> {
  const mod = notifications();
  if (!mod) return { status: 'unavailable' };
  try {
    const existing = await mod.getPermissionsAsync();
    if (existing.granted) return { status: 'granted' };
    const asked = await mod.requestPermissionsAsync();
    return { status: asked.granted ? 'granted' : 'denied' };
  } catch {
    return { status: 'error' };
  }
}

/** Check without prompting. */
export async function reminderPermissionStatus(): Promise<PermissionResult> {
  const mod = notifications();
  if (!mod) return { status: 'unavailable' };
  try {
    const status = await mod.getPermissionsAsync();
    return { status: status.granted ? 'granted' : 'denied' };
  } catch {
    return { status: 'error' };
  }
}

function reminderContent(habit: Habit): { title: string; body: string } {
  return {
    title: `${habit.emoji} ${habit.title}`,
    body: 'Time to check it off! ✅', 
  };
}

function reminderTime(habit: Habit): { hour: number; minute: number } {
  const r = habit.reminder;
  if (r?.time) {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(r.time.trim());
    if (match) return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
  }
  if (typeof r?.hour === 'number' && typeof r?.minute === 'number') {
    return { hour: r.hour, minute: r.minute };
  }
  return { hour: 8, minute: 0 };
}

/**
 * Replace the app's reminder schedule with exactly what the current habits
 * and settings imply, returning the identifiers map to persist.
 */
export async function syncHabitReminders(
  habits: Habit[],
  enabled: boolean,
): Promise<Record<string, string[]>> {
  const mod = notifications();
  if (!mod) return {};
  const result: Record<string, string[]> = {};
  try {
    const scheduled = await mod.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.map((n) => mod.cancelScheduledNotificationAsync(n.identifier)));
    if (!enabled) return result;
    await ensureChannel();
    for (const habit of habits) {
      if (habit.archived || habit.reminder === null) continue;
      const ids: string[] = [];
      const content = reminderContent(habit);
      const triggers: ({ type: 'daily'; hour: number; minute: number; channelId: string } | { type: 'weekly'; weekday: number; hour: number; minute: number; channelId: string })[] = [];
      if (habit.frequency.type === 'daily') {
        triggers.push({
          type: 'daily',
          hour: reminderTime(habit).hour,
          minute: reminderTime(habit).minute,
          channelId: REMINDER_CHANNEL_ID,
        });
      } else {
        for (const day of habit.frequency.days) {
          // expo-notifications WEEKLY weekday: 1–7 with 1 = Sunday;
          // our Weekday is 0–6 with 0 = Sunday, hence +1.
          triggers.push({
            type: 'weekly',
            weekday: day + 1,
            hour: reminderTime(habit).hour,
            minute: reminderTime(habit).minute,
            channelId: REMINDER_CHANNEL_ID,
          });
        }
      }
      for (const trigger of triggers) {
        try {
          const id = await mod.scheduleNotificationAsync({
            identifier: makeId(),
            content,
            trigger,
          });
          ids.push(id);
        } catch (err) {
          if (isPermissionRestrictedError(err)) {
            throw new ReminderRestrictionError();
          }
          // Some OEMs reject scheduling under battery restrictions. Skip that
          // reminder but keep the rest of the schedule intact.
          console.warn('[notifications] schedule failed', err);
        }
      }
      if (ids.length > 0) result[habit.id] = ids;
    }
  } catch (err) {
    if (err instanceof ReminderRestrictionError) throw err;
    console.warn('[notifications] reminder sync failed', err);
  }
  return result;
}

/** FYI-only error surfaced when the OS actively restricts alarm scheduling. */
export class ReminderRestrictionError extends Error {
  constructor() {
    super(
      'Android restricted alarm scheduling for this app. Reminders may be delayed or dropped.',
    );
  }
}

function isPermissionRestrictedError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string' &&
    /denied|permission|exact|alarm/i.test((err as { message: string }).message)
  );
}

/** One-off smoke-test notification ("Send a test reminder"). */
export async function sendTestNotification(): Promise<PermissionResult> {
  const mod = notifications();
  if (!mod) return { status: 'unavailable' };
  const perm = await requestReminderPermission();
  if (perm.status !== 'granted') return perm;
  try {
    await ensureChannel();
    await mod.scheduleNotificationAsync({
      identifier: makeId(),
      content: {
        title: '🔔 Test reminder',
        body: 'If you can read this, habit reminders are working.',
      },
      trigger: { type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: REMINDER_CHANNEL_ID },
    });
    return { status: 'granted' };
  } catch {
    return { status: 'error' };
  }
}

/** Remove every scheduled reminder (used before clearing all data). */
export async function cancelAllReminders(): Promise<void> {
  const mod = notifications();
  if (!mod) return;
  try {
    await mod.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}

/** Precise helper used by tests / UI copy. */
export function reminderTriggerCount(habit: Habit): number {
  if (habit.reminder === null) return 0;
  return habit.frequency.type === 'daily' ? 1 : Math.max(habit.frequency.days.length, 0);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Store-facing adapter.
 *
 * `useHabitStore` tracks reminder times as a local 'HH:MM' string and weekday
 * selections as `frequency.weekdays`, so these read the habit structurally
 * instead of assuming the legacy `{ hour, minute }` / `.days` shapes.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ReminderHabitLike {
  id: string;
  title: string;
  emoji: string;
  archived: boolean;
  frequency: { type: 'daily' } | { type: 'weekdays'; weekdays?: number[]; days?: number[] };
  reminder?: { time?: string; hour?: number; minute?: number } | null;
}

/** Selected weekdays for a habit; empty means "daily". */
export function reminderDays(frequency: ReminderHabitLike['frequency']): number[] {
  if (frequency.type === 'daily') return [];
  return frequency.weekdays ?? frequency.days ?? [];
}

/** 'HH:MM' (current) or { hour, minute } (legacy) → 24h clock, or null. */
export function reminderClock(habit: ReminderHabitLike): { hour: number; minute: number } | null {
  const reminder = habit.reminder;
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

/** Check permission without prompting. Never throws. */
export async function getPermissionStatus(): Promise<{ granted: boolean; denied: boolean }> {
  const mod = notifications();
  if (!mod) return { granted: false, denied: false };
  try {
    const status = await mod.getPermissionsAsync();
    return { granted: !!status.granted, denied: !status.granted && status.canAskAgain === false };
  } catch {
    return { granted: false, denied: false };
  }
}

/** Prompt for permission once; resolves to whether reminders may be scheduled. */
export async function requestPermission(): Promise<boolean> {
  const mod = notifications();
  if (!mod) return false;
  try {
    if ((await mod.getPermissionsAsync()).granted) return true;
    return !!(await mod.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Reconcile the OS reminder schedule with the current habits.
 *
 * Cancels exactly the identifiers handed in via `previous` (rather than
 * everything the app scheduled), then re-schedules from scratch, returning the
 * new identifier map for the caller to persist. Resolves to `{}` on web, where
 * expo-notifications is unavailable, and never throws — a denied or restricted
 * alarm simply yields an empty schedule.
 */
export async function syncReminders(
  habits: ReminderHabitLike[],
  previous: Record<string, string[]>,
  enabled: boolean,
): Promise<Record<string, string[]>> {
  const mod = notifications();
  if (!mod) return {};

  const stale = Object.values(previous ?? {}).flat().filter((id) => typeof id === 'string');
  if (stale.length > 0) {
    try {
      await Promise.all(stale.map((id) => mod.cancelScheduledNotificationAsync(id)));
    } catch {
      // Identifiers may already have been cancelled or expired — nothing to do.
    }
  }

  const result: Record<string, string[]> = {};
  if (!enabled) return result;
  await ensureChannel();

  for (const habit of habits) {
    if (habit.archived) continue;
    const clock = reminderClock(habit);
    if (!clock) continue;

    const days = reminderDays(habit.frequency);
    const content = { title: `${habit.emoji} ${habit.title}`, body: 'Time to check it off! ✅' };
    // expo-notifications WEEKLY weekday runs 1–7 with 1 = Sunday, while ours is
    // 0–6 with 0 = Sunday, hence the +1.
    const triggers =
      days.length === 0
        ? [{ type: 'daily' as const, hour: clock.hour, minute: clock.minute, channelId: REMINDER_CHANNEL_ID }]
        : days.map((day) => ({
            type: 'weekly' as const,
            weekday: day + 1,
            hour: clock.hour,
            minute: clock.minute,
            channelId: REMINDER_CHANNEL_ID,
          }));

    const ids: string[] = [];
    for (const trigger of triggers) {
      try {
        ids.push(await mod.scheduleNotificationAsync({ content, trigger }));
      } catch (err) {
        // Some OEMs reject scheduling under battery restrictions. Skip that one
        // reminder but keep the rest of the schedule intact.
        console.warn('[notifications] schedule failed', err);
      }
    }
    if (ids.length > 0) result[habit.id] = ids;
  }
  return result;
}
