/**
 * Habit store — single source of truth, context-based.
 *
 * Hydration is load-first / write-later: nothing is persisted until the
 * initial load completes, so stored data is never clobbered by defaults.
 * All writes trigger a single-flight save through `storage.saveData`.
 * Completion records: exactly one per (habit, local date); unchecking
 * rewrites that same record with count 0 (history preserved, never duplicated).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type {
  AppData,
  Habit,
  HabitInput,
  NotificationStatus,
  Settings,
} from '@/lib/types';
import { loadData, saveData, clearData as clearStorageData } from '@/lib/storage';
import {
  ensureChannel,
  getPermissionStatus,
  syncReminders,
} from '@/lib/notifications';
import { localDateKey } from '@/lib/dates';
import { resolveTheme, type ThemeTokens } from '@/lib/theme';

type HabitStore = {
  hydrated: boolean;
  habits: Habit[];
  completions: AppData['completions'];
  settings: Settings;
  notificationStatus: NotificationStatus;
  tokens: ThemeTokens;
  activeHabits: Habit[];
  archivedHabits: Habit[];
  getHabit: (id: string | undefined) => Habit | undefined;
  countOn: (habitId: string, dateKey: string) => number;
  addHabit: (input: HabitInput) => Promise<Habit | null>;
  updateHabit: (id: string, input: HabitInput) => Promise<boolean>;
  deleteHabit: (id: string) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  toggleCompletion: (habitId: string, dateKey: string) => void;
  stepCompletion: (habitId: string, dateKey: string, direction: 1 | -1) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setReminderTime: (habitId: string, time: string | undefined) => Promise<void>;
  refreshNotificationStatus: () => Promise<void>;
  clearAllData: () => Promise<void>;
  exportData: () => AppData;
};

const HabitStoreContext = createContext<HabitStore | null>(null);

/** Stable unique id — timestamp + random suffix, never an array index. */
function newId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function habitFromInput(input: HabitInput, base?: Habit): Habit {
  const nowKey = localDateKey();
  const habit: Habit = base
    ? { ...base }
    : {
        id: newId(),
        title: '',
        category: 'Personal',
        emoji: '🌱',
        color: '#A6F36A',
        frequency: { type: 'daily' },
        target: 1,
        createdAt: new Date().toISOString(),
        createdAtKey: nowKey,
        archived: false,
      };
  habit.title = input.title;
  if (input.description.trim()) habit.description = input.description.trim();
  else delete habit.description;
  habit.category = input.category;
  habit.emoji = input.emoji;
  habit.color = input.color;
  habit.frequency =
    input.frequencyType === 'daily'
      ? { type: 'daily' }
      : {
          type: 'weekdays',
          weekdays: Array.from(new Set(input.weekdays)).sort((a, b) => a - b),
        };
  habit.target = input.target;
  if (input.reminderTime) habit.reminder = { time: input.reminderTime };
  else delete habit.reminder;
  if (base) {
    // Changing creation-date-derived fields is never allowed.
    habit.createdAt = base.createdAt;
    habit.createdAtKey = base.createdAtKey;
  }
  return habit;
}

export function HabitStoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<AppData['completions']>({});
  const [reminders, setReminders] = useState<Record<string, string[]>>({});
  const [settings, setSettingsState] = useState<Settings>({
    theme: 'dark',
    weekStart: 'sun',
    notificationsEnabled: true,
  });
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>('unknown');
  const system = useColorScheme();

  // ---- hydrate on mount -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadData();
      if (cancelled) return;
      setHabits(data.habits);
      setCompletions(data.completions);
      setReminders(data.reminders);
      setSettingsState(data.settings);
      setHydrated(true);
      try {
        const status = await getPermissionStatus();
        setNotificationStatus(status.granted ? 'granted' : status.denied ? 'denied' : 'undetermined');
      } catch {
        setNotificationStatus('unknown');
      }
      void ensureChannel().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- single-writer persistence (events, not data flow) --------------------
  const dataRef = useRef({ habits, completions, reminders, settings });
  useEffect(() => {
    dataRef.current = { habits, completions, reminders, settings };
  }, [habits, completions, reminders, settings]);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const lastSavedJson = useRef('');

  useEffect(() => {
    if (!hydrated) return;
    saveChain.current = saveChain.current
      .then(() => {
        const next = {
          habits: dataRef.current.habits,
          completions: dataRef.current.completions,
          reminders: dataRef.current.reminders,
          settings: dataRef.current.settings,
        };
        const json = JSON.stringify(next);
        if (json === lastSavedJson.current) return;
        lastSavedJson.current = json;
        return saveData(next);
      })
      .catch(() => undefined);
  }, [habits, completions, reminders, settings, hydrated]);

  // ---- reminder resynchronization (idempotent) ------------------------------
  const idsHashRef = useRef('');
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      let effectiveStatus = notificationStatus;
      if (effectiveStatus === 'unknown') {
        try {
          const status = await getPermissionStatus();
          effectiveStatus = status.granted ? 'granted' : status.denied ? 'denied' : 'undetermined';
          if (!cancelled) setNotificationStatus(effectiveStatus);
        } catch {
          return;
        }
      }
      const granted = effectiveStatus === 'granted';
      try {
        const next = await syncReminders(
          dataRef.current.habits,
          dataRef.current.reminders,
          dataRef.current.settings.notificationsEnabled && granted,
        );
        if (cancelled) return;
        const hash = JSON.stringify(next);
        if (hash !== idsHashRef.current) {
          idsHashRef.current = hash;
          setReminders(next); // triggers persistence of stored identifiers
        }
      } catch {
        // Scheduling failures are logged inside syncReminders; never crash.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, notificationStatus, habits, settings.notificationsEnabled]);

  // ---- actions ---------------------------------------------------------------
  const addHabit = useCallback(async (input: HabitInput): Promise<Habit | null> => {
    if (!input.title.trim()) return null; // duplicate/invalid submissions rejected here
    const habit = habitFromInput({ ...input });
    setHabits((prev) => [habit, ...prev]);
    return habit;
  }, []);

  const updateHabit = useCallback(async (id: string, input: HabitInput): Promise<boolean> => {
    if (!input.title.trim()) return false;
    setHabits((prev) => prev.map((h) => (h.id === id ? habitFromInput({ ...input }, h) : h)));
    return true;
  }, []);

  const deleteHabit = useCallback(async (id: string): Promise<void> => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    // Completion history is intentionally retained: deleted habits must not
    // corrupt historical records; analytics simply stops aggregating them.
  }, []);

  const setArchived = useCallback(async (id: string, archived: boolean): Promise<void> => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, archived } : h)));
  }, []);

  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const toggleCompletion = useCallback((habitId: string, dateKey: string): void => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit) return;
    setCompletions((prev) => {
      const day = prev[dateKey] ?? {};
      const record = day[habitId];
      const isComplete = !!record && record.count >= habit.target;
      return {
        ...prev,
        [dateKey]: {
          ...day,
          [habitId]: {
            count: isComplete ? 0 : Math.max(1, habit.target),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const stepCompletion = useCallback((habitId: string, dateKey: string, direction: 1 | -1): void => {
    const habit = habitsRef.current.find((h) => h.id === habitId);
    if (!habit) return;
    setCompletions((prev) => {
      const day = prev[dateKey] ?? {};
      const current = day[habitId]?.count ?? 0;
      const count = Math.min(habit.target, Math.max(0, current + direction));
      return {
        ...prev,
        [dateKey]: {
          ...day,
          [habitId]: { count, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>): void => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setReminderTime = useCallback(async (habitId: string, time: string | undefined): Promise<void> => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const next = { ...h };
        if (time) next.reminder = { time };
        else delete next.reminder;
        return next;
      }),
    );
  }, []);

  const refreshNotificationStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await getPermissionStatus();
      setNotificationStatus(status.granted ? 'granted' : status.denied ? 'denied' : 'undetermined');
    } catch {
      setNotificationStatus('unknown');
    }
  }, []);

  const clearAllData = useCallback(async (): Promise<void> => {
    await clearStorageData();
    await saveChain.current.catch(() => undefined);
    lastSavedJson.current = '';
    setHabits([]);
    setCompletions({});
    setReminders({});
    await saveData({
      habits: [],
      completions: {},
      reminders: {},
      settings: dataRef.current.settings,
    }).catch(() => undefined);
  }, []);

  const exportData = useCallback((): AppData => {
    return {
      habits: dataRef.current.habits,
      completions: dataRef.current.completions,
      reminders: dataRef.current.reminders,
      settings: dataRef.current.settings,
    };
  }, []);

  const tokens = useMemo(
    () => resolveTheme(settings.theme, system),
    [settings.theme, system],
  );

  const { activeHabits, archivedHabits } = useMemo(() => {
    const act: Habit[] = [];
    const arch: Habit[] = [];
    for (const h of habits) (h.archived ? arch : act).push(h);
    return { activeHabits: act, archivedHabits: arch };
  }, [habits]);

  const getHabit = useCallback(
    (id: string | undefined): Habit | undefined => (id ? habits.find((h) => h.id === id) : undefined),
    [habits],
  );

  const countOn = useCallback(
    (habitId: string, dateKey: string): number =>
      completions[dateKey]?.[habitId]?.count ?? 0,
    [completions],
  );

  const value: HabitStore = useMemo(
    () => ({
      hydrated,
      habits,
      completions,
      settings,
      notificationStatus,
      tokens,
      activeHabits,
      archivedHabits,
      getHabit,
      countOn,
      addHabit,
      updateHabit,
      deleteHabit,
      setArchived,
      toggleCompletion,
      stepCompletion,
      updateSettings,
      setReminderTime,
      refreshNotificationStatus,
      clearAllData,
      exportData,
    }),
    [
      hydrated,
      habits,
      completions,
      settings,
      notificationStatus,
      tokens,
      activeHabits,
      archivedHabits,
      getHabit,
      countOn,
      addHabit,
      updateHabit,
      deleteHabit,
      setArchived,
      toggleCompletion,
      stepCompletion,
      updateSettings,
      setReminderTime,
      refreshNotificationStatus,
      clearAllData,
      exportData,
    ],
  );

  return <HabitStoreContext.Provider value={value}>{children}</HabitStoreContext.Provider>;
}

export function useHabitStore(): HabitStore {
  const ctx = useContext(HabitStoreContext);
  if (!ctx) throw new Error('useHabitStore must be used inside <HabitStoreProvider>');
  return ctx;
}
