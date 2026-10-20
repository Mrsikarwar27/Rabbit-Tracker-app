import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
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
import { Card } from '@/components/ui';
import { formatDateLabel, monthLabel, monthName, parseDateKey, weekdayOrder } from '@/lib/dates';
import { monthReport } from '@/lib/analytics';
import { isCompletedOn, isScheduledOn } from '@/lib/streaks';

type DayState = 'done' | 'partial' | 'missed' | 'scheduled' | 'off';

export default function Calendar() {
  const { activeHabits, completions, settings } = useHabitStore();
  const { tokens } = useTheme();
  const todayKey = useToday();
  const insets = useSafeAreaInsets();
  const todayDate = parseDateKey(todayKey);
  const [monthOffset, setMonthOffset] = useState(0);

  const view = useMemo(() => {
    const first = new Date(todayDate.getFullYear(), todayDate.getMonth() + monthOffset, 1);
    return { year: first.getFullYear(), month: first.getMonth() };
  }, [todayDate, monthOffset]);

  const [selectedKey, setSelectedKey] = useState(todayKey);
  const viewIsCurrentMonth = monthOffset === 0;

  const monthFirstKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01`;
  const monthLastKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}-31`;
  const selectionInView = selectedKey >= monthFirstKey && selectedKey <= monthLastKey;
  useEffect(() => {
    if (!selectionInView) setSelectedKey(monthFirstKey); // eslint-disable-line react-hooks/set-state-in-effect
  }, [selectionInView, monthFirstKey]);

  const grid = useMemo(() => {
    const report = monthReport(activeHabits, completions, view.year, view.month, todayKey);
    const firstDow =
      (parseDateKey(report[0].dateKey).getDay() - (settings.weekStart === 'mon' ? 1 : 0) + 7) % 7;
    const cells: (null | {
      key: string;
      rate: number;
      scheduled: number;
      future: boolean;
    })[] = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (const row of report) {
      cells.push({
        key: row.dateKey,
        rate: row.rate,
        scheduled: row.scheduled,
        future: row.dateKey > todayKey,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const lines: (null | { key: string; rate: number; scheduled: number; future: boolean })[][] = [];
    for (let i = 0; i < cells.length; i += 7) lines.push(cells.slice(i, i + 7));
    return lines;
  }, [activeHabits, completions, view, todayKey, settings.weekStart]);

  const dayDetail = useMemo(
    () =>
      activeHabits.map((habit) => ({
        habit,
        state: (isScheduledOn(habit, selectedKey)
          ? isCompletedOn(habit, completions, selectedKey)
            ? 'done'
            : selectedKey < todayKey
              ? 'missed'
              : selectedKey === todayKey
                ? 'partial'
                : 'scheduled'
          : selectedKey <= todayKey
            ? 'off'
            : null) as DayState | null,
      })),
    [activeHabits, completions, selectedKey, todayKey],
  );

  const stateColor = (state: DayState | null): string => {
    switch (state) {
      case 'done':
        return tokens.success;
      case 'missed':
        return tokens.error;
      case 'partial':
        return tokens.primary;
      case 'scheduled':
        return tokens.secondary;
      default:
        return tokens.textSecondary;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScreenHeader title={monthLabel(view.year, view.month)} subtitle="Tap a day to inspect it" showBack />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.navRow}>
          <Pressable
            onPress={() => setMonthOffset((m) => m - 1)}
            style={[styles.navBtn, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={{ color: tokens.textPrimary, fontSize: 18 }}>←</Text>
          </Pressable>
          {!viewIsCurrentMonth ? (
            <Pressable onPress={() => setMonthOffset(0)} accessibilityRole="button">
              <Text style={[styles.backToday, { color: tokens.primary }]}>Back to today</Text>
            </Pressable>
          ) : (
            <Text style={[styles.monthText, { color: tokens.textTertiary }]}>
              {monthName(view.month)} {view.year}
            </Text>
          )}
          <Pressable
            onPress={() => setMonthOffset((m) => m + 1)}
            style={[styles.navBtn, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Text style={{ color: tokens.textPrimary, fontSize: 18 }}>→</Text>
          </Pressable>
        </View>

        <Card style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {weekdayOrder(settings.weekStart).map((wd: number) => (
              <Text
                key={wd}
                style={[styles.weekday, { color: tokens.textTertiary }]}
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd as number]}
              </Text>
            ))}
          </View>
          {grid.map((line, i) => (
            <View key={`row-${i}`} style={styles.weekRow}>
              {line.map((cell, j) => (
                <View key={j} style={styles.dayCell}>
                  {cell ? (
                    <Pressable
                      onPress={() => setSelectedKey(cell.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cell.key === selectedKey }}
                      accessibilityLabel={cell.key}
                      style={[
                        styles.dayBox,
                        {
                          borderColor:
                            cell.key === selectedKey
                              ? tokens.primary
                              : cell.key === todayKey
                                ? tokens.borderStrong
                                : 'transparent',
                          backgroundColor:
                            cell.key === selectedKey ? tokens.primaryContainer : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          {
                            color:
                              cell.key === selectedKey ? tokens.onPrimaryContainer : tokens.textPrimary,
                            fontWeight: cell.key === todayKey ? '800' : '400',
                          },
                        ]}
                      >
                        {Number(cell.key.slice(8))}
                      </Text>
                      {cell.scheduled > 0 ? (
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                cell.rate >= 1
                                  ? tokens.success
                                  : cell.rate > 0
                                    ? tokens.primary
                                    : cell.future
                                      ? tokens.borderStrong
                                      : tokens.error,
                              opacity: cell.rate > 0 && cell.rate < 1 ? 0.6 : 1,
                            },
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </Card>

        <Card style={styles.calendarCard}>
          <Text style={[styles.detailTitle, { color: tokens.textPrimary }]}>
            {formatDateLabel(selectedKey)}
          </Text>
          {selectedKey > todayKey ? (
            <Text style={[styles.detailHint, { color: tokens.textSecondary }]}>
              Future day — not part of history yet.
            </Text>
          ) : null}
          {dayDetail.every((d) => d.state === null) ? (
            <Text style={[styles.detailHint, { color: tokens.textTertiary }]}>
              No active habits scheduled on this date.
            </Text>
          ) : (
            <View style={styles.detailList}>
              {dayDetail
                .filter((d) => d.state !== null)
                .map(({ habit, state }) => (
                  <View key={habit.id} style={[styles.detailRow, { borderTopColor: tokens.border }]}>
                    <Text style={styles.detailEmoji}>{habit.emoji}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.detailName, { color: tokens.textPrimary }]}
                    >
                      {habit.title}
                    </Text>
                    <Text style={[styles.detailState, { color: stateColor(state) }]}>
                      {state === 'done'
                        ? 'Done'
                        : state === 'missed'
                          ? 'Missed'
                          : state === 'partial'
                            ? 'In progress'
                            : state === 'scheduled'
                              ? 'Scheduled'
                              : '—'}
                    </Text>
                  </View>
                ))}
            </View>
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToday: {
    fontSize: 13,
    fontWeight: '700',
  },
  monthText: {
    fontSize: 12,
  },
  calendarCard: {
    marginTop: 16,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
  },
  dayBox: {
    flex: 1,
    borderRadius: 12,
    margin: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayNumber: {
    fontSize: 13,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  detailHint: {
    fontSize: 12.5,
    marginTop: 6,
  },
  detailList: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 46,
  },
  detailEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  detailName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  detailState: {
    fontSize: 12,
    fontWeight: '700',
  },
});
