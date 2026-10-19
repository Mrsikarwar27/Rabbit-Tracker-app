import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { useToday } from '@/hooks/useToday';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatDateLabel, monthLabel, monthName, parseDateKey, weekdayOrder } from '@/lib/dates';
import { monthReport } from '@/lib/analytics';
import { isCompletedOn, isScheduledOn } from '@/lib/streaks';

type DayState = 'done' | 'partial' | 'missed' | 'scheduled' | 'off';

export default function Calendar() {
  const { tokens, activeHabits, completions, settings } = useHabitStore();
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

  // Default the inspection to the 1st of the month being viewed when it
  // switches to a month the current selection isn't in.
  const monthFirstKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01`;
  const monthLastKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}-31`;
  const selectionInView = selectedKey >= monthFirstKey && selectedKey <= monthLastKey;
  useEffect(() => {
    if (!selectionInView) setSelectedKey(monthFirstKey); // eslint-disable-line react-hooks/set-state-in-effect
  }, [selectionInView, monthFirstKey]);

  const grid = useMemo(() => {
    const report = monthReport(activeHabits, completions, view.year, view.month, todayKey);
    const firstDow =
      (parseDateKey(report[0].dateKey).getDay() - (settings.weekStart === 1 ? 1 : 0) + 7) % 7;
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

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <StatusBar barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={tokens.bg} />
      <ScreenHeader title={monthLabel(view.year, view.month)} subtitle="Tap a day to inspect it" tokens={tokens} showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <TouchableOpacity onPress={() => setMonthOffset((m) => m - 1)} style={[styles.navBtn, { borderColor: tokens.border }]} hitSlop={4}>
            <Text style={{ color: tokens.text, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          {!viewIsCurrentMonth ? (
            <TouchableOpacity onPress={() => setMonthOffset(0)} hitSlop={4}>
              <Text style={{ color: tokens.accent, fontSize: 13, fontWeight: '700' }}>Back to today</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: tokens.muted, fontSize: 11 }}>
              {monthName(view.month)} {view.year}
            </Text>
          )}
          <TouchableOpacity onPress={() => setMonthOffset((m) => m + 1)} style={[styles.navBtn, { borderColor: tokens.border }]} hitSlop={4}>
            <Text style={{ color: tokens.text, fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.calendarCard, { backgroundColor: tokens.card, borderColor: tokens.border, marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {weekdayOrder(settings.weekStart).map((wd) => (
              <Text key={wd} style={{ flex: 1, textAlign: 'center', color: tokens.muted, fontSize: 10, fontWeight: '700' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd]}
              </Text>
            ))}
          </View>
          {grid.map((line, i) => (
            <View key={`row-${i}`} style={{ flexDirection: 'row' }}>
              {line.map((cell, j) => (
                <View key={j} style={{ flex: 1, aspectRatio: 1 }}>
                  {cell ? (
                    <TouchableOpacity
                      onPress={() => setSelectedKey(cell.key)}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        margin: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor:
                          cell.key === selectedKey ? tokens.accent : cell.key === todayKey ? tokens.border : 'transparent',
                      }}
                    >
                      <Text style={{ color: tokens.text, fontSize: 13, fontWeight: cell.key === todayKey ? '800' : '400' }}>
                        {Number(cell.key.slice(8))}
                      </Text>
                      {cell.scheduled > 0 ? (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            marginTop: 2,
                            backgroundColor:
                              cell.rate >= 1 ? tokens.accent : cell.rate > 0 ? tokens.accent : cell.future ? tokens.border : tokens.danger,
                            opacity: cell.rate > 0 && cell.rate < 1 ? 0.45 : 1,
                          }}
                        />
                      ) : null}
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
          <Text style={{ color: tokens.muted, fontSize: 10, marginTop: 8 }}>
            ● all done   ◑ partial   red = missed   gray = scheduled / future
          </Text>
        </View>

        <View style={[styles.calendarCard, { backgroundColor: tokens.card, borderColor: tokens.border, marginTop: 16 }]}>
          <Text style={{ color: tokens.text, fontSize: 15, fontWeight: '800' }}>{formatDateLabel(selectedKey)}</Text>
          {selectedKey > todayKey ? (
            <Text style={{ color: tokens.sub, fontSize: 12, marginTop: 4 }}>Future day — not part of history yet.</Text>
          ) : null}
          {dayDetail.every((d) => d.state === null) ? (
            <Text style={{ color: tokens.muted, fontSize: 13, marginTop: 10 }}>
              No active habits scheduled on this date.
            </Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {dayDetail
                .filter((d) => d.state !== null)
                .map(({ habit, state }) => (
                  <View key={habit.id} style={[styles.detailRow, { borderTopColor: tokens.border }]}>
                    <Text style={{ fontSize: 16, marginRight: 10 }}>{habit.emoji}</Text>
                    <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                      {habit.title}
                    </Text>
                    <Text
                      style={{
                        color:
                          state === 'done'
                            ? tokens.accent
                            : state === 'missed'
                              ? tokens.danger
                              : state === 'partial'
                                ? tokens.accent
                                : tokens.sub,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {state === 'done'
                        ? '✓ Done'
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: { borderRadius: 20, borderWidth: 1, padding: 14 },
  navBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, minHeight: 44 },
});
