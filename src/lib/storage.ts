import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCENT_COLORS,
  DEFAULT_SETTINGS,
  defaultAppData,
  type AppData,
  type CompletionEntry,
  type Completions,
  type Habit,
  type HabitCategoryKey,
  type HabitFrequency,
  type Settings,
} from './types';
import { isDateKey, todayKey } from './date';

/**
 * Single-key, versioned persistence. All AsyncStorage knowledge stays here.
 *
 * Guarantees:
 * • Load never throws and never silently overwrites: if a blob is corrupt we
 *   return "defaults + corrupt: true"; the UI decides what to do (banner +
 *   explicit reset). Until the user acts, the corrupt blob is NOT rewritten.
 * • Writes are serialized through one promise chain and a trailing debounce,
 *   so rapid toggles collapse into the latest state — no interleaved writes,
 *   no lost updates from out-of-order resolutions.
 * • Untrusted JSON is sanitized field-by-field before it reaches the app.
 */

const STORAGE_KEY = 'habit-tracker/data/v1';

export interface LoadResult {
  data: AppData;
  /** 'corrupt' → blob existed but could not be parsed/sanitized. */
  corrupt: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const VALID_CATEGORIES: HabitCategoryKey[] = [
  'health',
  'fitness',
  'learning',
  'productivity',
  'personal',
];

function sanitizeFrequency(input: unknown): HabitFrequency {
  if (isPlainObject(input) && input.type === 'weekdays' && Array.isArray(input.days)) {
    const days = input.days.filter(
      (d): d is 0 | 1 | 2 | 3 | 4 | 5 | 6 =>
        typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    if (days.length > 0) return { type: 'weekdays', days };
  }
  return { type: 'daily' };
}

function sanitizeHabit(input: unknown): Habit | null {
  if (!isPlainObject(input)) return null;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;
  const now = todayKey();
  const category =
    typeof input.category === 'string' &&
    (VALID_CATEGORIES as string[]).includes(input.category)
      ? (input.category as HabitCategoryKey)
      : 'personal';
  const color =
    typeof input.color === 'string' && (ACCENT_COLORS as readonly string[]).includes(input.color)
      ? input.color
      : ACCENT_COLORS[0];
  const targetNum =
    typeof input.target === 'number' && Number.isFinite(input.target) && input.target >= 1
      ? Math.min(Math.floor(input.target), 50)
      : 1;
  let reminder: Habit['reminder'] = null;
  if (
    isPlainObject(input.reminder) &&
    typeof input.reminder.hour === 'number' &&
    typeof input.reminder.minute === 'number' &&
    input.reminder.hour >= 0 && input.reminder.hour <= 23 &&
    input.reminder.minute >= 0 && input.reminder.minute <= 59 &&
    Number.isInteger(input.reminder.hour) && Number.isInteger(input.reminder.minute)
  ) {
    reminder = { hour: input.reminder.hour, minute: input.reminder.minute };
  }
  const createdAt = isDateKey(input.createdAt) ? input.createdAt : now;
  const archived = input.archived === true;
  const archivedAt =
    archived && isDateKey(input.archivedAt) ? (input.archivedAt as string) : undefined;
  return {
    id: typeof input.id === 'string' && input.id.length > 0 ? input.id : makeId(),
    title,
    description: typeof input.description === 'string' ? input.description : '',
    category,
    emoji: typeof input.emoji === 'string' && input.emoji.length > 0 ? input.emoji : '✅',
    color,
    frequency: sanitizeFrequency(input.frequency),
    target: targetNum,
    reminder,
    createdAt,
    archived,
    archivedAt,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  };
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function sanitizeCompletions(input: unknown): Completions {
  const out: Completions = {};
  if (!isPlainObject(input)) return out;
  for (const [habitId, byDate] of Object.entries(input)) {
    if (typeof habitId !== 'string' || habitId.length === 0 || !isPlainObject(byDate)) continue;
    for (const [date, entry] of Object.entries(byDate)) {
      if (!isDateKey(date) || !isPlainObject(entry)) continue;
      const count = typeof entry.count === 'number' && Number.isFinite(entry.count)
        ? Math.max(0, Math.min(Math.floor(entry.count), 50))
        : 0;
      if (count <= 0) continue; // ghost/zero entries are dropped
      const clean: CompletionEntry = {
        count,
        updatedAt:
          typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
      };
      (out[habitId] ??= {})[date] = clean;
    }
  }
  return out;
}

function sanitizeSettings(input: unknown): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS };
  if (!isPlainObject(input)) return base;
  if (input.theme === 'dark' || input.theme === 'light' || input.theme === 'system') {
    base.theme = input.theme;
  }
  if (input.weekStart === 0 || input.weekStart === 1) base.weekStart = input.weekStart;
  if (typeof input.notificationsEnabled === 'boolean') {
    base.notificationsEnabled = input.notificationsEnabled;
  }
  return base;
}

export function sanitizeData(input: unknown): AppData | null {
  const data = defaultAppData();
  if (!isPlainObject(input)) return null;
  if (input.version !== 1) return null; // unknown/missing schema version
  if (!Array.isArray(input.habits)) return null;
  const habits: Habit[] = [];
  for (const raw of input.habits) {
    const h = sanitizeHabit(raw);
    if (h) habits.push(h);
  }
  const seen = new Set<string>();
  const deduped = habits.filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
  data.habits = deduped;
  data.completions = sanitizeCompletions(input.completions);
  data.settings = sanitizeSettings(input.settings);
  data.notificationIds = isPlainObject(input.notificationIds)
    ? Object.fromEntries(
        Object.entries(input.notificationIds).filter(
          ([k, v]) => typeof k === 'string' && Array.isArray(v),
        ),
      ) as AppData['notificationIds']
    : {};
  return data;
}

export async function loadAppData(): Promise<LoadResult> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage itself failed (e.g. web private mode). Run with defaults but
    // treat as corrupt so we never overwrite anything we could not read.
    return { data: defaultAppData(), corrupt: true };
  }
  if (raw === null) return { data: defaultAppData(), corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    const data = sanitizeData(parsed);
    if (data) return { data, corrupt: false };
    return { data: defaultAppData(), corrupt: true };
  } catch {
    return { data: defaultAppData(), corrupt: true };
  }
}

/* ── write queue ──────────────────────────────────────────────────────────── */

type Persistable = Pick<AppData, 'habits' | 'completions' | 'settings' | 'notificationIds'>;

let chain: Promise<void> = Promise.resolve();
let pendingData: Persistable | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let storageAvailable = true;

const DEBOUNCE_MS = 350;

function writeNow(data: Persistable): Promise<void> {
  const doc: AppData = {
    version: 1,
    habits: data.habits,
    completions: data.completions,
    settings: data.settings,
    notificationIds: data.notificationIds,
    updatedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify(doc);
  return AsyncStorage.setItem(STORAGE_KEY, payload).then(() => {
    storageAvailable = true;
  });
}

/**
 * Schedule a save. Trailing-debounced and serialized: only the most recent
 * data snapshot is ever written, and writes never overlap.
 */
export function scheduleSave(data: Persistable): void {
  if (!storageAvailable) return;
  pendingData = data;
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (pendingData === null) return;
    const snapshot = pendingData;
    pendingData = null;
    chain = chain
      .then(() => writeNow(snapshot))
      .catch((err) => {
        storageAvailable = false;
        console.warn('[storage] persist failed; writes disabled this session', err);
      });
  }, DEBOUNCE_MS);
}

/** Fire any pending save immediately (used for clearing data). */
export function flushSave(): Promise<void> {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  const snapshot = pendingData;
  pendingData = null;
  if (snapshot === null) return chain;
  chain = chain.then(() => writeNow(snapshot)).catch((err) => {
    storageAvailable = false;
    console.warn('[storage] persist failed', err);
  });
  return chain;
}

/** Wipe everything (user-initiated). */
export async function clearStoredData(): Promise<void> {
  scheduleSave(defaultAppData());
  await flushSave();
}
