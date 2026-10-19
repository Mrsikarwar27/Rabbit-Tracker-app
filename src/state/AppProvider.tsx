import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, useColorScheme, type AppStateStatus } from 'react-native';
import type {
  Completions,
  Habit,
  Settings,
  ThemePreference,
} from '../lib/types';
import {
  makeId,
  loadAppData,
  scheduleSave,
  clearStoredData,
  flushSave,
  type LoadResult,
} from '../lib/storage';
import { todayKey } from '../lib/date';
import {
  effectiveTarget,
  nextCountAfterIncrement,
  nextCountAfterToggle,
} from '../lib/habit-logic';
import { DARK, paletteFor, type Palette } from '../lib/theme';
import { syncHabitReminders } from '../lib/notifications';

/**
 * Central store: habits + completions + settings + reminder ids.
 *
 * • Every mutation updates state first (immediate re-render), then schedules
 *   a serialized, debounced persist. UI never waits on storage.
 * • If the stored blob was unreadable we NEVER overwrite it silently; the
 *   banner stays until the user explicitly resets, or performs a mutation
 *   (which then persists fresh, user-intended data).
 * • `today` is provider state so all streaks/dashboards recompute after a
 *   local midnight rollover, app foregrounding, or refresh.
 */

interface AppStateCtx {
  ready: boolean;
  /** Stored blob existed but was unreadable → banner overdue. */
  corruptBannerVisible: boolean;
  habits: Habit[];
  completions: Completions;
  settings: Settings;
  today: string;
  colors: Palette;
  isDark: boolean;
  addHabit: (draft: HabitDraft) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  toggleHabitDay: (habitId: string, dateKey: string) => void;
  incrementHabitDay: (habitId: string, dateKey: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: ThemePreference) => void;
  resetAllData: () => Promise<void>;
  dismissCorruptBanner: () => void;
}

export type HabitDraft = Omit<
  Habit,
  'id' | 'createdAt' | 'updatedAt' | 'archived' | 'archivedAt'
>;

const Ctx = createContext<AppStateCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [corruptStored, setCorruptStored] = useState(false);
  const [corruptBannerVisible, setCorruptBannerVisible] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completions>({});
  const [settings, setSettingsState] = useState<Settings>({
    theme: 'dark',
    weekStart: 1,
    notificationsEnabled: true,
  });
  const [notificationIds, setNotificationIds] = useState<Record<string, string[]>>({});
  const [today, setToday] = useState(todayKey());

  const everMutated = useRef(false);
  const stateRef = useRef({
    habits,
    completions,
    settings,
    notificationIds,
  });

  useEffect(() => {
    stateRef.current = { habits, completions, settings, notificationIds };
  }, [habits, completions, settings, notificationIds]);

  const markMutated = useCallback(() => {
    everMutated.current = true;
  }, []);

  /* ── hydration ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result: LoadResult = await loadAppData();
      if (cancelled) return;
      setHabits(result.data.habits);
      setCompletions(result.data.completions);
      setSettingsState(result.data.settings);
      setNotificationIds(result.data.notificationIds);
      setCorruptStored(result.corrupt);
      setCorruptBannerVisible(result.corrupt);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── debounced persistence ─────────────────────────────────────────────── */
  useEffect(() => {
    // Never write over a corrupt blob until the user has made a change;
    // also skip before hydration completes.
    if (!ready) return;
    if (corruptStored && !everMutated.current) return;
    scheduleSave(stateRef.current);
  }, [habits, completions, settings, notificationIds, ready, corruptStored]);

  /* ── local-midnight rollover + save-on-background ──────────────────────── */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const check = () => {
      const key = todayKey();
      setToday((prev) => (prev === key ? prev : key));
    };
    const onAppState = (status: AppStateStatus) => {
      if (status !== 'active') return;
      check();
      flushSave().catch(() => undefined);
    };
    const sub = AppState.addEventListener('change', onAppState);
    timer = setInterval(check, 30_000);
    check();
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, []);

  /* ── habit reminder scheduling ─────────────────────────────────────────── */
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    syncHabitReminders(stateRef.current.habits, stateRef.current.settings.notificationsEnabled)
      .then((ids) => {
        if (cancelled) return;
        stateRef.current.notificationIds = ids;
        setNotificationIds(ids);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, habits, settings.notificationsEnabled]);

  /* ── mutations ─────────────────────────────────────────────────────────── */
  const addHabit = useCallback(
    (draft: HabitDraft): Habit => {
      markMutated();
      const habit: Habit = {
        ...draft,
        id: makeId(),
        createdAt: todayKey(),
        archived: false,
        updatedAt: new Date().toISOString(),
      };
      setHabits((prev) => [...prev, habit]);
      return habit;
    },
    [markMutated],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Habit>) => {
      markMutated();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h,
        ),
      );
    },
    [markMutated],
  );

  const deleteHabit = useCallback(
    (id: string) => {
      markMutated();
      // Completion records are deliberately kept: calendar history and
      // lifetime totals stay truthful; the habit just leaves all lists.
      setHabits((prev) => prev.filter((h) => h.id !== id));
    },
    [markMutated],
  );

  const setArchived = useCallback(
    (id: string, archived: boolean) => {
      markMutated();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                archived,
                archivedAt: archived ? todayKey() : undefined,
                updatedAt: new Date().toISOString(),
              }
            : h,
        ),
      );
    },
    [markMutated],
  );

  const toggleHabitDay = useCallback(
    (habitId: string, dateKey: string) => {
      markMutated();
      const habit = stateRef.current.habits.find((h) => h.id === habitId);
      if (!habit) return;
      const tk = todayKey();
      if (dateKey > tk) return; // never write the future
      if (dateKey < habit.createdAt) return; // habit did not exist yet
      setCompletions((prev) => {
        const next: Completions = { ...prev };
        const byDate = { ...(next[habitId] ?? {}) };
        const count = byDate[dateKey]?.count ?? 0;
        const newCount = nextCountAfterToggle(habit, count);
        if (newCount <= 0) {
          delete byDate[dateKey]; // uncheck leaves no ghost records
        } else {
          byDate[dateKey] = { count: newCount, updatedAt: Date.now() };
        }
        if (Object.keys(byDate).length === 0) delete next[habitId];
        else next[habitId] = byDate;
        return next;
      });
    },
    [markMutated],
  );

  const incrementHabitDay = useCallback(
    (habitId: string, dateKey: string) => {
      markMutated();
      const habit = stateRef.current.habits.find((h) => h.id === habitId);
      if (!habit) return;
      const tk = todayKey();
      if (dateKey > tk) return;
      if (dateKey < habit.createdAt) return;
      setCompletions((prev) => {
        const next: Completions = { ...prev };
        const byDate = { ...(next[habitId] ?? {}) };
        const count = byDate[dateKey]?.count ?? 0;
        if (count >= effectiveTarget(habit)) return prev;
        byDate[dateKey] = {
          count: nextCountAfterIncrement(habit, count),
          updatedAt: Date.now(),
        };
        next[habitId] = byDate;
        return next;
      });
    },
    [markMutated],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      markMutated();
      setSettingsState((prev) => ({ ...prev, ...patch }));
    },
    [markMutated],
  );

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      markMutated();
      setSettingsState((prev) => ({ ...prev, theme }));
    },
    [markMutated],
  );

  const resetAllData = useCallback(async () => {
    setHabits([]);
    setCompletions({});
    setNotificationIds({});
    setSettingsState({ theme: 'dark', weekStart: 1, notificationsEnabled: true });
    setCorruptStored(false);
    setCorruptBannerVisible(false);
    await clearStoredData();
  }, []);

  const dismissCorruptBanner = useCallback(() => {
    setCorruptBannerVisible(false);
  }, []);

  const systemScheme = useColorScheme();
  const colors = useMemo(
    () => paletteFor(settings.theme, systemScheme === 'light' ? 'light' : 'dark'),
    [settings.theme, systemScheme],
  );

  const value = useMemo<AppStateCtx>(
    () => ({
      ready,
      corruptBannerVisible,
      habits,
      completions,
      settings,
      today,
      colors,
      isDark: colors === DARK,
      addHabit,
      updateHabit,
      deleteHabit,
      setArchived,
      toggleHabitDay,
      incrementHabitDay,
      setSettings,
      setTheme,
      resetAllData,
      dismissCorruptBanner,
    }),
    [
      ready,
      corruptBannerVisible,
      habits,
      completions,
      settings,
      today,
      colors,
      addHabit,
      updateHabit,
      deleteHabit,
      setArchived,
      toggleHabitDay,
      incrementHabitDay,
      setSettings,
      setTheme,
      resetAllData,
      dismissCorruptBanner,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
