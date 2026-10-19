import React from 'react';
import { Text, View } from 'react-native';
import type { Habit, CompletionMap, WeekStart } from '@/lib/types';
import type { ThemeTokens } from '@/lib/theme';
import { isCompletedOn, isScheduledOn } from '@/lib/streaks';
import { parseDateKey, startOfWeekKey, shiftDateKey, weekdayShort } from '@/lib/dates';

type Props = {
  habits: Habit[];
  completions: CompletionMap;
  weekStart: WeekStart;
  todayKey: string;
  tokens: ThemeTokens;
};

/**
 * Weekly overview: 7 mini-bars for the current (whole) week.
 * Each bar shows scheduled-vs-completed rate; today's bar has an accent border.
 * Future scheduled days show a neutral "scheduled" bar — never "missed".
 */
export function WeekStrip({ habits, completions, weekStart, todayKey, tokens }: Props) {
  const start = startOfWeekKey(todayKey, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((dateKey) => {
        const weekday = parseDateKey(dateKey).getDay();
        const scheduled = habits.filter((h) => isScheduledOn(h, dateKey));
        const done = scheduled.filter((h) => isCompletedOn(h, completions, dateKey));
        const rate = scheduled.length ? done.length / scheduled.length : 0;
        const isFuture = dateKey > todayKey;
        const isToday = dateKey === todayKey;
        const full = scheduled.length > 0 && !isFuture && done.length === scheduled.length;

        return (
          <View key={dateKey} style={{ alignItems: 'center', flex: 1 }}>
            <View
              style={{
                height: 44,
                width: '100%',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isToday ? tokens.accent : tokens.border,
                backgroundColor: tokens.card,
                overflow: 'hidden',
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  height: `${Math.round(rate * 100)}%` as `${number}%`,
                  backgroundColor: full ? tokens.accent : tokens.muted,
                  opacity: isFuture ? 0.25 : 1,
                }}
              />
            </View>
            <Text
              style={{
                color: isToday ? tokens.accent : tokens.sub,
                fontSize: 10,
                marginTop: 6,
                fontWeight: isToday ? '700' : '400',
              }}
            >
              {weekdayShort(weekday)}
            </Text>
          </View>
        );
      })}
      {weekStart === 'mon' ? null : null}
    </View>
  );
}
