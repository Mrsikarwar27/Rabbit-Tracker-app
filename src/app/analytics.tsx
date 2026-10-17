import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { useToday } from '@/hooks/useToday';
import { ScreenHeader } from '@/components/ScreenHeader';
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
  const { tokens, activeHabits, habits, completions } = useHabitStore();
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

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <StatusBar barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={tokens.bg} />
      <ScreenHeader title="Analytics" subtitle="Computed from your real history" tokens={tokens} showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.statGrid}>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statValue, { color: tokens.accent }]}>{Math.round(today.rate * 100)}%</Text>
            <Text style={[styles.statLabel, { color: tokens.sub }]}>Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statValue, { color: tokens.accent }]}>🔥 {maxCurrent}</Text>
            <Text style={[styles.statLabel, { color: tokens.sub }]}>Current streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statValue, { color: tokens.text }]}>{maxLongest}</Text>
            <Text style={[styles.statLabel, { color: tokens.sub }]}>Longest streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={[styles.statValue, { color: tokens.text }]}>{totalDays}</Text>
            <Text style={[styles.statLabel, { color: tokens.sub }]}>Habit-days done</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>LAST 14 DAYS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90, marginTop: 14 }}>
            {trend.map((d) => (
              <View key={d.dateKey} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 66, width: '100%', justifyContent: 'flex-end' }}>
                  <View
                    style={{
                      height: `${Math.round(d.rate * 100)}%` as `${number}%`,
                      backgroundColor: d.rate >= 1 ? tokens.accent : tokens.muted,
                      borderRadius: 4,
                      minHeight: d.scheduled ? 2 : 0,
                      opacity: d.scheduled ? 1 : 0.2,
                    }}
                  />
                </View>
                <Text style={{ color: tokens.muted, fontSize: 8, marginTop: 4 }}>
                  {weekdayShort(parseDateKey(d.dateKey).getDay()).slice(0, 1)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
            {month.label.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
            <Text style={{ color: tokens.text, fontSize: 24, fontWeight: '800' }}>
              {Math.round(month.rate * 100)}%
            </Text>
            <Text style={{ color: tokens.sub, fontSize: 13, marginLeft: 10, marginBottom: 3 }}>
              {month.completed} / {month.scheduled} scheduled
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>BEST HABITS (30 DAYS)</Text>
          {best.length === 0 || best.every((b) => b.scheduled === 0) ? (
            <Text style={{ color: tokens.muted, fontSize: 13, marginTop: 10 }}>
              Nothing scheduled in the last 30 days yet.
            </Text>
          ) : (
            best.map(({ habit, scheduled, completed, rate }) => (
              <View key={habit.id} style={[styles.bestRow, { borderTopColor: tokens.border }]}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>{habit.emoji}</Text>
                <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 }}>
                  {habit.title}
                </Text>
                <View style={{ width: 70, height: 7, borderRadius: 4, backgroundColor: tokens.border, overflow: 'hidden', marginRight: 8 }}>
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: habit.color,
                      width: `${Math.round(rate * 100)}%` as `${number}%`,
                    }}
                  />
                </View>
                <Text style={{ color: tokens.sub, fontSize: 11, width: 56, textAlign: 'right' }}>
                  {completed}/{scheduled}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 16, borderWidth: 1, padding: 16 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 14 },
  bestRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 10, minHeight: 44 },
});
