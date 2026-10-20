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

/** Reminder time in local 24-hour notation, or legacy hour/minute. */
export interface HabitReminder {
  time?: string; // HH:MM format preferred
  hour?: number;
  minute?: number;
}

export interface Habit {
  /** Stable opaque id. Never use an array index as an id. */
  id: string;
  title: string;
  description?: string; // optional
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
  /** Derived local date key (optional, for streak calculations). */
  createdAtKey?: string;
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
export type CompletionEntry = { count: number; updatedAt: string };
export type Completions = Record<string, Record<string, CompletionEntry>>;

export type ThemePreference = 'dark' | 'light' | 'system';

export type CardStyle = 'standard' | 'rounded' | 'minimal';
export type ListDensity = 'compact' | 'comfortable';

export interface AppearancePreferences {
  accent: string;
  cardStyle: CardStyle;
  density: ListDensity;
  reducedMotion: boolean;
  /** Corner radius for cards, in dp. */
  cornerRadius: number;
}

export interface Settings {
  theme: ThemePreference;
  /** 'sun' = Sunday, 'mon' = Monday */
  weekStart: WeekStart;
  /** Master switch for habit reminders. */
  notificationsEnabled: boolean;
  /** Appearance customizations. */
  appearance: AppearancePreferences;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  accent: '#A6F36A',
  cardStyle: 'standard',
  density: 'comfortable',
  reducedMotion: false,
  cornerRadius: 20,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  weekStart: 'mon',
  notificationsEnabled: true,
  appearance: { ...DEFAULT_APPEARANCE },
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

/* ────────────────────────────────────────────────────────────────────────────
 * Additive API used by the habit screens/hooks (useHabitStore + src/app/*).
 * Kept alongside the legacy key-based model above so both can coexist.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Display-name category, rendered directly as its own label in the habit form. */
export type Category = HabitCategoryKey;

export const CATEGORIES: readonly Category[] = [
  'health',
  'fitness',
  'learning',
  'productivity',
  'personal',
];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

/** First day of the week, as a preference string (not a 0/1 index). */
export type WeekStart = 'sun' | 'mon';

/**
 * Completion records keyed by LOCAL date key, then habit id — exactly one record
 * per (habit, date); unchecking rewrites that record with count 0.
 */
export type CompletionMap = Record<string, Record<string, CompletionEntry>>;

export type NotificationStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';

/** Form-shaped payload produced by the habit form and applied by the store. */
export interface HabitInput {
  title: string;
  description: string;
  category: Category;
  emoji: string;
  color: string;
  frequencyType: 'daily' | 'weekdays';
  weekdays: number[];
  target: number;
  /** Local 24h 'HH:MM', or '' for no reminder. */
  reminderTime: string;
}
