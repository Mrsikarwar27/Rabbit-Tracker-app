import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore, useTheme } from '@/hooks/useHabitStore';
import { useToday } from '@/hooks/useToday';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, ProgressBar, SectionLabel } from '@/components/ui';
import {
  dayRates,
  habitRatesOverDays,
  monthlySummary,
  rateForDate,
  totalHabitDays,
} from '@/lib/analytics';
import { lastNDays, parseDateKey, weekdayShort } from '@/lib/dates';
import { currentStreak, longestStreak } from '@/lib/streaks';

export default function Analytics() {
  const { activeHabits, habits, completions } = useHabitStore();
  const { tokens } = useTheme();
  const todayKey = useToday();
  const insets = useSafeAreaInsets();

  const last30 = useMemo(() => lastNDays(todayKey, 30), [todayKey]);
  const last14 = useMemo(() => lastNDays(todayKey, 14), [todayKey]);

  const today = useMemo(
    () => rateForDate(activeHabits, completions, todayKey),
    [activeHabits, completions, todayKey],
  );

  const todayDate = parseDateKey(todayKey);
  const month = useMemo(
    () =>
      monthlySummary(
        activeHabits,
        completions,
        todayDate.getFullYear(),
        todayDate.getMonth(),
        todayKey,
      ),
    [activeHabits, completions, todayDate, todayKey],
  );

  const trend = useMemo(
    () => dayRates(activeHabits, completions, last14, todayKey),
    [activeHabits, completions, last14, todayKey],
  );

  const best = useMemo(
    () => habitRatesOverDays(activeHabits, completions, last30),
    [activeHabits, completions, last30],
  );

  const maxCurrent = useMemo(
    () => activeHabits.reduce((m, h) => Math.max(m, currentStreak(h, completions, todayKey)), 0),
    [activeHabits, completions, todayKey],
  );
  const maxLongest = useMemo(
    () => activeHabits.reduce((m, h) => Math.max(m, longestStreak(h, completions, todayKey)), 0),
    [activeHabits, completions, todayKey],
  );
  const totalDays = useMemo(() => totalHabitDays(habits, completions), [habits, completions]);

  const stats = [
    { value: `${Math.round(today.rate * 100)}%`, label: 'Today', accent: true },
    { value: `🔥 ${maxCurrent}`, label: 'Current streak', accent: false },
    { value: `${maxLongest}`, label: 'Longest streak', accent: false },
    { value: `${totalDays}`, label: 'Habit-days done', accent: false },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScreenHeader title="Insights" subtitle="Computed from your real history" showBack />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats grid */}
        <View style={styles.statGrid}>
          {stats.map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.accent ? tokens.primary : tokens.textPrimary }]}>
                {s.value}
              </Text>
              <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>{s.label}</Text>
            </Card>
          ))}
        </View>

        {/* Trend chart */}
        <Card style={styles.card}>
          <SectionLabel>LAST 14 DAYS</SectionLabel>
          <View style={styles.chart}>
            {trend.map((d) => (
              <View key={d.dateKey} style={styles.chartColumn}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.round(d.rate * 100)}%` as `${number}%`,
                        backgroundColor: d.rate >= 1 ? tokens.primary : tokens.surfaceContainer,
                        opacity: d.scheduled ? 1 : 0.25,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartLabel, { color: tokens.textTertiary }]}>
                  {weekdayShort(parseDateKey(d.dateKey).getDay()).slice(0, 1)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Month summary */}
        <Card style={styles.card}>
          <SectionLabel>{month.label.toUpperCase()}</SectionLabel>
          <View style={styles.monthRow}>
            <Text style={[styles.monthValue, { color: tokens.textPrimary }]}>
              {Math.round(month.rate * 100)}%
            </Text>
            <Text style={[styles.monthCaption, { color: tokens.textSecondary }]}>
              {month.completed} / {month.scheduled} scheduled
            </Text>
          </View>
          <ProgressBar value={month.rate} style={styles.monthBar} />
        </Card>

        {/* Best habits */}
        <Card style={styles.card}>
          <SectionLabel>BEST HABITS (30 DAYS)</SectionLabel>
          {best.length === 0 || best.every((b) => b.scheduled === 0) ? (
            <Text style={[styles.empty, { color: tokens.textTertiary }]}>
              Nothing scheduled in the last 30 days yet.
            </Text>
          ) : (
            best.map(({ habit, scheduled, completed, rate }) => (
              <View key={habit.id} style={[styles.bestRow, { borderTopColor: tokens.border }]}>
                <Text style={styles.bestEmoji}>{habit.emoji}</Text>
                <Text
                  numberOfLines={1}
                  style={[styles.bestName, { color: tokens.textPrimary }]}
                >
                  {habit.title}
                </Text>
                <View style={styles.bestBar}>
                  <ProgressBar value={rate} height={7} color={habit.color} />
                </View>
                <Text style={[styles.bestCount, { color: tokens.textSecondary }]}>
                  {completed}/{scheduled}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 15,
  },
  statValue: {
    fontSize: 23,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    marginTop: 14,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 96,
    marginTop: 14,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartTrack: {
    height: 70,
    width: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 8,
    marginTop: 5,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  monthValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  monthCaption: {
    fontSize: 13,
    marginLeft: 10,
    marginBottom: 3,
  },
  monthBar: {
    marginTop: 12,
  },
  empty: {
    fontSize: 13,
    marginTop: 10,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 11,
    minHeight: 48,
  },
  bestEmoji: {
    fontSize: 15,
    marginRight: 8,
  },
  bestName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  bestBar: {
    width: 68,
    marginRight: 8,
  },
  bestCount: {
    fontSize: 11,
    width: 54,
    textAlign: 'right',
  },
});
