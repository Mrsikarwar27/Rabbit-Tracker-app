import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { useToday } from '@/hooks/useToday';
import { HabitRow } from '@/components/HabitRow';
import { WeekStrip } from '@/components/WeekStrip';
import { currentStreak, isCompletedOn, isScheduledOn } from '@/lib/streaks';
import { formatDateLabel } from '@/lib/dates';

function greeting(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Index() {
  const {
    hydrated,
    activeHabits,
    completions,
    settings,
    tokens,
    toggleCompletion,
    stepCompletion,
    getHabit,
  } = useHabitStore();
  const todayKey = useToday();
  const insets = useSafeAreaInsets();

  const today = useMemo(() => {
    const scheduled = activeHabits.filter((h) => isScheduledOn(h, todayKey));
    const done = scheduled.filter((h) => isCompletedOn(h, completions, todayKey));
    return { scheduled, done, rate: scheduled.length ? done.length / scheduled.length : 0 };
  }, [activeHabits, completions, todayKey]);

  const bestCurrentStreak = useMemo(
    () =>
      activeHabits.reduce((max, h) => Math.max(max, currentStreak(h, completions, todayKey)), 0),
    [activeHabits, completions, todayKey],
  );

  const sorted = useMemo(() => {
    const incomplete = today.scheduled.filter((h) => !today.done.includes(h));
    const done = today.done;
    const other = activeHabits.filter((h) => !isScheduledOn(h, todayKey));
    return { incomplete, done, other };
  }, [today, activeHabits, todayKey]);

  const isLoading = !hydrated;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <StatusBar barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={tokens.bg} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ color: tokens.accent, fontSize: 12, fontWeight: '700', letterSpacing: 3 }}>
            TODAY
          </Text>
          <Text style={{ color: tokens.text, fontSize: 34, fontWeight: '800', marginTop: 10 }}>
            {greeting(new Date().getHours())}.
          </Text>
          <Text style={{ color: tokens.sub, fontSize: 13, marginTop: 4 }}>{formatDateLabel(todayKey)}</Text>
        </View>

        {/* Progress card */}
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
            TODAY'S PROGRESS
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 }}>
            <Text style={{ color: tokens.accent, fontSize: 30, fontWeight: '800' }}>
              {Math.round(today.rate * 100)}%
            </Text>
            <Text style={{ color: tokens.sub, fontSize: 14, marginLeft: 10, marginBottom: 4 }}>
              {today.done.length} of {today.scheduled.length} completed
            </Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: tokens.border, marginTop: 14, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                borderRadius: 5,
                backgroundColor: tokens.accent,
                width: `${Math.round(today.rate * 100)}%` as `${number}%`,
              }}
            />
          </View>

          {/* Streak + weekly overview */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
            <View style={{ alignItems: 'center', marginRight: 22 }}>
              <Text style={{ color: tokens.text, fontSize: 22, fontWeight: '800' }}>🔥 {bestCurrentStreak}</Text>
              <Text style={{ color: tokens.sub, fontSize: 11, marginTop: 2 }}>current streak</Text>
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <WeekStrip
              habits={activeHabits}
              completions={completions}
              weekStart={settings.weekStart}
              todayKey={todayKey}
              tokens={tokens}
            />
          </View>
        </View>

        {/* Content states */}
        {isLoading ? (
          <Text style={{ color: tokens.muted, textAlign: 'center', marginTop: 40 }}>Restoring your data…</Text>
        ) : activeHabits.length === 0 ? (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border, marginTop: 28, alignItems: 'center', paddingVertical: 30 }]}>
            <Text style={{ fontSize: 40 }}>🌱</Text>
            <Text style={{ color: tokens.text, fontSize: 17, fontWeight: '700', marginTop: 10 }}>
              No habits yet
            </Text>
            <Text style={{ color: tokens.sub, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
              Start with one small habit. Add your first to begin your streak.
            </Text>
            <Link href="/habit-form" asChild>
              <TouchableOpacity
                style={{
                  backgroundColor: tokens.accent,
                  borderRadius: 14,
                  paddingVertical: 13,
                  paddingHorizontal: 22,
                  marginTop: 18,
                  minHeight: 48,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: tokens.onAccent, fontWeight: '700', fontSize: 15 }}>+ Add habit</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border, marginTop: 28 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>
                TODAY'S HABITS
              </Text>
              <Link href="/habits" asChild>
                <TouchableOpacity hitSlop={8}>
                  <Text style={{ color: tokens.sub, fontSize: 12, fontWeight: '700' }}>Edit habits</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {sorted.incomplete.length + sorted.done.length + sorted.other.length === 0 ? (
              <Text style={{ color: tokens.sub, fontSize: 13, marginTop: 14 }}>
                Rest day — nothing scheduled today.
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {sorted.incomplete.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    tokens={tokens}
                    completions={completions}
                    dateKey={todayKey}
                    onPress={() => router.push(`/habit-form?id=${h.id}`)}
                    onToggle={() => toggleCompletion(h.id, todayKey)}
                    onStep={(d) => stepCompletion(h.id, todayKey, d)}
                  />
                ))}
                {sorted.done.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, marginTop: 8, paddingTop: 10 }}>
                    <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>
                      DONE ✓
                    </Text>
                    {sorted.done.map((h) => (
                      <HabitRow
                        key={h.id}
                        habit={h}
                        tokens={tokens}
                        completions={completions}
                        dateKey={todayKey}
                        onPress={() => router.push(`/habit-form?id=${h.id}`)}
                        onToggle={() => toggleCompletion(h.id, todayKey)}
                        onStep={(d) => stepCompletion(h.id, todayKey, d)}
                      />
                    ))}
                  </View>
                )}
                {sorted.other.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, marginTop: 8, paddingTop: 10 }}>
                    <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>
                      NOT SCHEDULED TODAY
                    </Text>
                    {sorted.other.map((h) => (
                      <HabitRow
                        key={h.id}
                        habit={h}
                        tokens={tokens}
                        completions={completions}
                        dateKey={todayKey}
                        disabled
                        onPress={() => undefined}
                        onToggle={() => undefined}
                        onStep={() => undefined}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tokens.card,
          borderTopWidth: 1,
          borderTopColor: tokens.border,
          flexDirection: 'row',
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        }}
      >
        {[
          { href: '/', label: 'Home', emoji: '☀️', active: true },
          { href: '/calendar', label: 'Calendar', emoji: '📅', active: false },
          { href: '/analytics', label: 'Stats', emoji: '📈', active: false },
          { href: '/settings', label: 'Settings', emoji: '⚙️', active: false },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href} asChild>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 6, minHeight: 48, justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{tab.emoji}</Text>
              <Text style={{ color: tab.active ? tokens.accent : tokens.sub, fontSize: 10, marginTop: 2, fontWeight: tab.active ? '700' : '400' }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          </Link>
        ))}
      </View>

      {/* Quick add */}
      <Link href="/habit-form" asChild>
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 80,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: tokens.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ color: tokens.onAccent, fontSize: 28, fontWeight: '700', marginBottom: 2 }}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginTop: 22,

  },
});
