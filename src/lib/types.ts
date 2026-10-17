/**
 * Domain types for the Habit Tracker.
 *
 * All dates are LOCAL calendar dates in `YYYY-MM-DD` form (Indian Standard Time
 * friendly). Never convert these keys through UTC — that shifts days at
 * midnight. See src/lib/date.ts.
 */

/** 0 = Sunday … 6 = Saturday (same numbering as Date#getDay()). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HabitCategoryKey =
  | 'health'
  | 'fitness'
  | 'learning'
  | 'productivity'
  | 'personal';

export interface HabitCategoryMeta {
  key: HabitCategoryKey;
  label: string;
  emoji: string;
}

export const HABIT_CATEGORIES: HabitCategoryMeta[] = [
  { key: 'health', label: 'Health', emoji: '🌿' },
  { key: 'fitness', label: 'Fitness', emoji: '💪' },
  { key: 'learning', label: 'Learning', emoji: '📚' },
  { key: 'productivity', label: 'Productivity', emoji: '⚡' },
  { key: 'personal', label: 'Personal', emoji: '🧘' },
];

export function getCategoryMeta(key: HabitCategoryKey): HabitCategoryMeta {
  return HABIT_CATEGORIES.find((c) => c.key === key) ?? HABIT_CATEGORIES[4];
}

/** Lifecycle of a habit's schedule. */
export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: Weekday[] };

/** Reminder time in local 24-hour notation. */
export interface HabitReminder {
  hour: number; // 0–23
  minute: number; // 0–59
}

export interface Habit {
  /** Stable opaque id. Never use an array index as an id. */
  id: string;
  title: string;
  description: string;
  category: HabitCategoryKey;
  emoji: string;
  /** Accent color as hex (one of ACCENT_COLORS). */
  color: string;
  frequency: HabitFrequency;
  /**
   * Optional completions-per-day target.
   * A habit day is "completed" when the recorded count >= target (target
   * defaults to 1; see effectiveTarget in habit-logic.ts).
   */
  target: number;
  reminder: HabitReminder | null;
  /** Local YYYY-MM-DD on which the habit was created. */
  createdAt: string;
  archived: boolean;
  /** Local YYYY-MM-DD when archived (streaks freeze afterward). */
  archivedAt?: string;
  updatedAt: string; // ISO timestamp, bookkeeping only
}

/**
 * count >= effectiveTarget(habit) means the habit-day is completed.
 * Multiple records for the same (habit, date) are impossible by construction
 * (it is a keyed map, never an array).
 */
export type CompletionEntry = { count: number; updatedAt: number };
export type Completions = Record<string, Record<string, CompletionEntry>>;

export type ThemePreference = 'dark' | 'light' | 'system';

export interface Settings {
  theme: ThemePreference;
  /** 0 = Sunday, 1 = Monday */
  weekStart: Weekday;
  /** Master switch for habit reminders. */
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  weekStart: 1,
  notificationsEnabled: true,
};

/** Persisted in one versioned document under a single AsyncStorage key. */
export interface AppData {
  version: 1;
  habits: Habit[];
  completions: Completions;
  settings: Settings;
  /** habitId -> scheduled notification identifiers (for cancellation). */
  notificationIds: Record<string, string[]>;
  /** ISO timestamp of the last write; bookkeeping only. */
  updatedAt: string | null;
}

export function defaultAppData(): AppData {
  return {
    version: 1,
    habits: [],
    completions: {},
    settings: { ...DEFAULT_SETTINGS },
    notificationIds: {},
    updatedAt: null,
  };
}

export const ACCENT_COLORS = [
  '#A6F36A', // signature green
  '#6EC3FF', // sky blue
  '#FFB86C', // tangerine
  '#FF7DA6', // pink
  '#B89CFF', // violet
  '#4DDBC4', // teal
  '#FFD35C', // amber
] as const;

export const HABIT_EMOJIS = [
  '💪', '🏃', '💧', '🥗', '🧘', '📚', '✍️', '🧠', '🎸', '🎼',
  '🌙', '☀️', '⚡', '🎯', '💰', '🧹', '🛏️', '📵', '📷', '🌱',
  '🚴', '🏊', '🍎', '🥛', '💊', '🪥', '📝', '💻', '🎨', '🙏',
] as const;
