import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCENT_COLORS,
  DEFAULT_APPEARANCE,
  DEFAULT_SETTINGS,
  defaultAppData,
  type AppearancePreferences,
  type AppData,
  type CompletionEntry,
  type Completions,
  type Habit,
  type HabitCategoryKey,
  type HabitFrequency,
  type Settings,
} from './types';
import { isDateKey, todayKey } from './date';
import { normalizeHex, CORNER_RADIUS_RANGE } from './theme';

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
  // Habit colours are user data: accept any valid hex so custom picks survive
  // a restart, and fall back to the first swatch when the value is broken.
  const color = normalizeHex(typeof input.color === 'string' ? input.color : '') ?? ACCENT_COLORS[0];
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
        updatedAt: String(
          typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
        ),
      };
      (out[habitId] ??= {})[date] = clean;
    }
  }
  return out;
}

function sanitizeSettings(input: unknown): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS, appearance: { ...DEFAULT_APPEARANCE } };
  if (!isPlainObject(input)) return base;
  if (input.theme === 'dark' || input.theme === 'light' || input.theme === 'system') {
    base.theme = input.theme;
  }
  if (input.weekStart === 'sun' || input.weekStart === 'mon') base.weekStart = input.weekStart;
  if (typeof input.notificationsEnabled === 'boolean') {
    base.notificationsEnabled = input.notificationsEnabled;
  }
  if (isPlainObject(input.appearance)) {
    const a = input.appearance;
    const accent = normalizeHex(typeof a.accent === 'string' ? a.accent : '');
    if (accent) base.appearance.accent = accent;
    if (a.cardStyle === 'standard' || a.cardStyle === 'rounded' || a.cardStyle === 'minimal') {
      base.appearance.cardStyle = a.cardStyle;
    }
    if (a.density === 'compact' || a.density === 'comfortable') base.appearance.density = a.density;
    if (typeof a.reducedMotion === 'boolean') base.appearance.reducedMotion = a.reducedMotion;
    if (typeof a.cornerRadius === 'number' && Number.isFinite(a.cornerRadius)) {
      base.appearance.cornerRadius = Math.max(
        CORNER_RADIUS_RANGE.min,
        Math.min(CORNER_RADIUS_RANGE.max, Math.round(a.cornerRadius)),
      );
    }
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

/* ────────────────────────────────────────────────────────────────────────────
 * Store-facing adapter.
 *
 * `useHabitStore` reads/writes a slightly different document shape than the
 * legacy API above, so these map between the two at the boundary:
 *   • completions are keyed by LOCAL DATE key, then habit id (the legacy
 *     sanitizer keys them habit-first, which would silently transpose data);
 *   • reminders are stored under `reminders`, not `notificationIds`;
 *   • weekStart is a 'sun' | 'mon' string rather than a 0/1 index.
 * ──────────────────────────────────────────────────────────────────────────── */

const ADAPTER_KEY = 'habit-tracker/data/v1';

export interface StoreSettings {
  theme: 'dark' | 'light' | 'system';
  weekStart: 'sun' | 'mon';
  notificationsEnabled: boolean;
  appearance: AppearancePreferences;
}

/**
 * Store-facing completion record. `updatedAt` is an ISO string here (the store
 * writes `new Date().toISOString()`), unlike the legacy numeric bookkeeping
 * timestamp on the `CompletionEntry` above.
 */
export interface StoreCompletionEntry {
  count: number;
  updatedAt: string;
}

export type StoreCompletionMap = Record<string, Record<string, StoreCompletionEntry>>;

export interface StoreData {
  habits: Habit[];
  completions: StoreCompletionMap;
  reminders: Record<string, string[]>;
  settings: StoreSettings;
}

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  theme: 'dark',
  weekStart: 'sun',
  notificationsEnabled: true,
  appearance: { ...DEFAULT_APPEARANCE },
};

/** Accept both the legacy 0/1 index and the current 'sun' | 'mon' string. */
function toWeekStart(value: unknown): 'sun' | 'mon' {
  if (value === 'sun' || value === 'mon') return value;
  if (value === 0) return 'sun';
  if (value === 1) return 'mon';
  return 'sun';
}

function toTheme(value: unknown): 'dark' | 'light' | 'system' {
  return value === 'light' || value === 'system' ? value : 'dark';
}

/** Sanitize the persisted appearance block; unknown values fall back. */
function toAppearance(value: unknown): AppearancePreferences {
  const out: AppearancePreferences = { ...DEFAULT_APPEARANCE };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  const raw = value as Record<string, unknown>;
  const accent = normalizeHex(typeof raw.accent === 'string' ? raw.accent : '');
  if (accent) out.accent = accent;
  if (raw.cardStyle === 'standard' || raw.cardStyle === 'rounded' || raw.cardStyle === 'minimal') {
    out.cardStyle = raw.cardStyle;
  }
  if (raw.density === 'compact' || raw.density === 'comfortable') out.density = raw.density;
  if (typeof raw.reducedMotion === 'boolean') out.reducedMotion = raw.reducedMotion;
  if (typeof raw.cornerRadius === 'number' && Number.isFinite(raw.cornerRadius)) {
    out.cornerRadius = Math.max(
      CORNER_RADIUS_RANGE.min,
      Math.min(CORNER_RADIUS_RANGE.max, Math.round(raw.cornerRadius)),
    );
  }
  return out;
}

function toReminders(value: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const [habitId, ids] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(ids)) out[habitId] = ids.filter((id): id is string => typeof id === 'string');
  }
  return out;
}

/**
 * Date-keyed completion map. Entries are kept even at count 0 — the store uses
 * them to tell "explicitly unchecked" apart from "never touched".
 */
function toCompletions(value: unknown): StoreCompletionMap {
  const out: StoreCompletionMap = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  for (const [dateKey, byHabit] of Object.entries(value as Record<string, unknown>)) {
    if (typeof byHabit !== 'object' || byHabit === null || Array.isArray(byHabit)) continue;
    const day: Record<string, StoreCompletionEntry> = {};
    for (const [habitId, entry] of Object.entries(byHabit as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { count } = entry as { count?: unknown };
      const numeric = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      day[habitId] = {
        count: numeric,
        updatedAt:
          typeof (entry as { updatedAt?: unknown }).updatedAt === 'string'
            ? (entry as { updatedAt: string }).updatedAt
            : new Date().toISOString(),
      };
    }
    out[dateKey] = day;
  }
  return out;
}

function toHabits(value: unknown): Habit[] {
  if (!Array.isArray(value)) return [];
  const out: Habit[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const habit = raw as Partial<Habit> & { id?: unknown };
    if (typeof habit.id !== 'string' || habit.id.length === 0 || seen.has(habit.id)) continue;
    seen.add(habit.id);
    out.push(habit as Habit);
  }
  return out;
}

/**
 * Load persisted data for the habit store.
 *
 * Never throws: unreadable or malformed blobs resolve to defaults so a bad
 * write can't brick the app on launch.
 */
export async function loadData(): Promise<StoreData> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(ADAPTER_KEY);
  } catch {
    return { habits: [], completions: {}, reminders: {}, settings: { ...DEFAULT_STORE_SETTINGS } };
  }
  if (raw === null) {
    return { habits: [], completions: {}, reminders: {}, settings: { ...DEFAULT_STORE_SETTINGS } };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    const doc = parsed as Record<string, unknown>;
    const rawSettings = (typeof doc.settings === 'object' && doc.settings !== null ? doc.settings : {}) as Record<string, unknown>;
    return {
      habits: toHabits(doc.habits),
      completions: toCompletions(doc.completions),
      reminders: toReminders(doc.reminders),
      settings: {
        theme: toTheme(rawSettings.theme),
        weekStart: toWeekStart(rawSettings.weekStart),
        notificationsEnabled: rawSettings.notificationsEnabled !== false,
        appearance: toAppearance(rawSettings.appearance),
      },
    };
  } catch {
    return { habits: [], completions: {}, reminders: {}, settings: { ...DEFAULT_STORE_SETTINGS } };
  }
}

/**
 * Persist a store snapshot. Serialized through the shared write chain so rapid
 * toggles can never interleave or land out of order.
 */
export async function saveData(data: StoreData): Promise<void> {
  const payload = JSON.stringify({
    version: 1,
    habits: data.habits,
    completions: data.completions,
    reminders: data.reminders,
    settings: data.settings,
    updatedAt: new Date().toISOString(),
  });
  chain = chain
    .then(() => AsyncStorage.setItem(ADAPTER_KEY, payload))
    .catch((err) => {
      console.warn('[storage] persist failed', err);
    });
  await chain;
}

/** Remove the stored document (user-initiated). */
export async function clearData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ADAPTER_KEY);
  } catch (err) {
    console.warn('[storage] clear failed', err);
  }
}
