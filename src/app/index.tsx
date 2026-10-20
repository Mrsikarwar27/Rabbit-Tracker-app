import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore, useTheme } from '@/hooks/useHabitStore';
import { useToday } from '@/hooks/useToday';
import { HabitRow } from '@/components/HabitRow';
import { WeekStrip } from '@/components/WeekStrip';
import { BottomNav } from '@/components/BottomNav';
import { NewHabitFab } from '@/components/NewHabitFab';
import { Card, Chip, PrimaryButton, ProgressBar, ProgressRing, SectionLabel } from '@/components/ui';
import { currentStreak, isCompletedOn, isScheduledOn, longestStreak } from '@/lib/streaks';
import { formatDateLabel, parseDateKey, weekdayShort } from '@/lib/dates';

type FilterKey = 'all' | 'morning' | 'afternoon' | 'evening' | 'pending' | 'completed';

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
];

function greeting(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Time-of-day band of a habit, derived from its reminder. */
function bandOf(reminderTime: string | undefined): 'morning' | 'afternoon' | 'evening' | null {
  if (!reminderTime) return null;
  const hour = parseInt(reminderTime.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return null;
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export default function Index() {
  const { hydrated, activeHabits, completions, settings, toggleCompletion, stepCompletion } =
    useHabitStore();
  const { tokens } = useTheme();
  const todayKey = useToday();
  const insets = useSafeAreaInsets();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const dayKey = selectedKey ?? todayKey;
  const isToday = dayKey === todayKey;

  /** Habits scheduled on the selected day, split by completion state. */
  const day = useMemo(() => {
    const scheduled = activeHabits.filter((h) => isScheduledOn(h, dayKey));
    const done = scheduled.filter((h) => isCompletedOn(h, completions, dayKey));
    const pending = scheduled.filter((h) => !isCompletedOn(h, completions, dayKey));
    return {
      scheduled,
      done,
      pending,
      rate: scheduled.length ? done.length / scheduled.length : 0,
    };
  }, [activeHabits, completions, dayKey]);

  /** Counts for the filter chips — all derived from the real data. */
  const counts = useMemo(() => {
    const byBand = { morning: 0, afternoon: 0, evening: 0 };
    for (const habit of day.scheduled) {
      const band = bandOf(habit.reminder?.time);
      if (band) byBand[band] += 1;
    }
    return {
      all: day.scheduled.length,
      morning: byBand.morning,
      afternoon: byBand.afternoon,
      evening: byBand.evening,
      pending: day.pending.length,
      completed: day.done.length,
    } as Record<FilterKey, number>;
  }, [day]);

  /** The list the user currently sees. */
  const visible = useMemo(() => {
    switch (filter) {
      case 'morning':
      case 'afternoon':
      case 'evening':
        return day.scheduled.filter((h) => bandOf(h.reminder?.time) === filter);
      case 'pending':
        return day.pending;
      case 'completed':
        return day.done;
      default:
        return day.scheduled;
    }
  }, [day, filter]);

  const streak = useMemo(
    () =>
      activeHabits.reduce((max, h) => Math.max(max, currentStreak(h, completions, todayKey)), 0),
    [activeHabits, completions, todayKey],
  );

  const best = useMemo(
    () =>
      activeHabits.reduce((max, h) => Math.max(max, longestStreak(h, completions, todayKey)), 0),
    [activeHabits, completions, todayKey],
  );

  const percent = Math.round(day.rate * 100);
  const dayLabel = formatDateLabel(dayKey);
  const shortDay = `${weekdayShort(parseDateKey(dayKey).getDay())} ${parseDateKey(dayKey).getDate()}`;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 130,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/images/rabbit-logo.png')}
              style={styles.logoImage}
            />
            <View style={styles.brandBlock}>
              <Text style={[styles.brand, { color: tokens.primary }]}>RABBIT TRACKER</Text>
              <Text style={[styles.greeting, { color: tokens.textPrimary }]}>
                {greeting(new Date().getHours())}.
              </Text>
              <Text style={[styles.dateLine, { color: tokens.textSecondary }]}>{dayLabel}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reminders and calendar"
              onPress={() => router.push('/calendar')}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.iconGlyph}>🔔</Text>
              {day.pending.length > 0 ? (
                <View style={[styles.badge, { backgroundColor: tokens.primary }]} />
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.iconGlyph}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Progress card ─────────────────────────────────────────────── */}
        <Card style={styles.progressCard}>
          <SectionLabel>{isToday ? "TODAY'S PROGRESS" : `${shortDay.toUpperCase()} PROGRESS`}</SectionLabel>

          <View style={styles.progressRow}>
            <ProgressRing value={day.rate} size={96} strokeWidth={9}>
              <Text style={[styles.ringValue, { color: tokens.textPrimary }]}>{percent}%</Text>
              <Text style={[styles.ringCaption, { color: tokens.textSecondary }]}>done</Text>
            </ProgressRing>

            <View style={styles.progressInfo}>
              <Text style={[styles.progressCount, { color: tokens.textPrimary }]}>
                {day.done.length} of {day.scheduled.length}
              </Text>
              <Text style={[styles.progressCaption, { color: tokens.textSecondary }]}>
                {day.scheduled.length === 0
                  ? 'nothing scheduled'
                  : isToday
                    ? 'completed today'
                    : 'completed'}
              </Text>
              <ProgressBar value={day.rate} style={styles.progressBar} />
            </View>
          </View>

          <View style={[styles.statRow, { borderTopColor: tokens.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: tokens.textPrimary }]}>🔥 {streak}</Text>
              <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>current streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: tokens.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: tokens.textPrimary }]}>🏆 {best}</Text>
              <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>personal best</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: tokens.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: tokens.textPrimary }]}>{day.done.length}</Text>
              <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>habits done</Text>
            </View>
          </View>
        </Card>

        {/* ── Week strip ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionLabel>THIS WEEK</SectionLabel>
          <View style={styles.weekWrap}>
            <WeekStrip
              habits={activeHabits}
              completions={completions}
              weekStart={settings.weekStart}
              todayKey={todayKey}
              selectedKey={dayKey}
              onSelect={setSelectedKey}
            />
          </View>
        </View>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>

        {/* ── Habit list ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.listHeader}>
            <SectionLabel>
              {isToday ? "TODAY'S HABITS" : `${shortDay.toUpperCase()} HABITS`}
            </SectionLabel>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage habits"
              onPress={() => router.push('/habits')}
              hitSlop={8}
            >
              <Text style={[styles.link, { color: tokens.primary }]}>Manage</Text>
            </Pressable>
          </View>

          {!hydrated ? (
            <Card style={styles.stateCard}>
              <Text style={[styles.stateText, { color: tokens.textSecondary }]}>
                Restoring your data…
              </Text>
            </Card>
          ) : activeHabits.length === 0 ? (
            <Card style={styles.stateCard}>
              <Text style={styles.stateEmoji}>🌱</Text>
              <Text style={[styles.stateTitle, { color: tokens.textPrimary }]}>No habits yet</Text>
              <Text style={[styles.stateText, { color: tokens.textSecondary }]}>
                Start with one small habit. Add your first to begin your streak.
              </Text>
              <PrimaryButton
                label="Add your first habit"
                onPress={() => router.push('/habit-form')}
                style={styles.stateButton}
              />
            </Card>
          ) : visible.length === 0 ? (
            <Card style={styles.stateCard}>
              <Text style={styles.stateEmoji}>✅</Text>
              <Text style={[styles.stateTitle, { color: tokens.textPrimary }]}>
                {filter === 'completed'
                  ? 'Nothing completed yet'
                  : filter === 'pending'
                    ? 'All done for this day'
                    : 'Nothing in this filter'}
              </Text>
              <Text style={[styles.stateText, { color: tokens.textSecondary }]}>
                {filter === 'completed'
                  ? 'Finish a habit and it will show up here.'
                  : filter === 'pending'
                    ? 'Every scheduled habit is checked off. Nice work.'
                    : 'Try another filter, or add a habit with a reminder time.'}
              </Text>
            </Card>
          ) : (
            <Card padded={false} style={styles.listCard}>
              {visible.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  completions={completions}
                  dateKey={dayKey}
                  onPress={() => router.push(`/habit-form?id=${habit.id}`)}
                  onToggle={() => toggleCompletion(habit.id, dayKey)}
                  onStep={(direction) => stepCompletion(habit.id, dayKey, direction)}
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <NewHabitFab />
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  logoImage: {
    width: 46,
    height: 46,
    borderRadius: 14,
    marginRight: 12,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 6,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  dateLine: {
    fontSize: 13.5,
    marginTop: 4,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressCard: {
    marginHorizontal: 20,
    marginTop: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 18,
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  ringCaption: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  progressInfo: {
    flex: 1,
  },
  progressCount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  progressCaption: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  progressBar: {
    marginTop: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10.5,
    marginTop: 3,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  weekWrap: {
    marginTop: 10,
  },
  filterScroll: {
    marginTop: 20,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
  },
  listCard: {
    overflow: 'hidden',
  },
  stateCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  stateEmoji: {
    fontSize: 40,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  stateText: {
    fontSize: 13.5,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 18,
    lineHeight: 20,
  },
  stateButton: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
});
