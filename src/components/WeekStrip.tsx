import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit, CompletionMap, WeekStart } from '@/lib/types';
import { isCompletedOn, isScheduledOn } from '@/lib/streaks';
import { parseDateKey, startOfWeekKey, shiftDateKey, weekdayShort } from '@/lib/dates';
import { useTheme } from '@/hooks/useHabitStore';

/**
 * Seven-day strip.
 *
 * Each cell shows the completion level of that day; the selected day gets the
 * accent border. The strip is tappable so the dashboard can follow a day.
 */
export function WeekStrip({
  habits,
  completions,
  weekStart,
  todayKey,
  selectedKey,
  onSelect,
}: {
  habits: Habit[];
  completions: CompletionMap;
  weekStart: WeekStart;
  todayKey: string;
  selectedKey?: string;
  onSelect?: (dateKey: string) => void;
}) {
  const { tokens } = useTheme();
  const start = startOfWeekKey(todayKey, weekStart);
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));

  return (
    <View style={styles.row}>
      {days.map((dateKey) => {
        const weekday = parseDateKey(dateKey).getDay();
        const scheduled = habits.filter((h) => isScheduledOn(h, dateKey));
        const done = scheduled.filter((h) => isCompletedOn(h, completions, dateKey));
        const rate = scheduled.length ? done.length / scheduled.length : 0;
        const isFuture = dateKey > todayKey;
        const isToday = dateKey === todayKey;
        const isSelected = dateKey === selectedKey;
        const full = scheduled.length > 0 && !isFuture && done.length === scheduled.length;

        return (
          <Pressable
            key={dateKey}
            onPress={onSelect ? () => onSelect(dateKey) : undefined}
            disabled={!onSelect}
            accessibilityRole="button"
            accessibilityLabel={weekdayShort(weekday)}
            accessibilityState={{ selected: isSelected }}
            style={styles.cell}
          >
            <View
              style={[
                styles.track,
                {
                  backgroundColor: tokens.surface,
                  borderColor: isSelected || isToday ? tokens.primary : tokens.border,
                  borderWidth: isSelected || isToday ? 1.5 : StyleSheet.hairlineWidth * 2,
                },
              ]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    height: `${Math.round(rate * 100)}%` as `${number}%`,
                    backgroundColor: full ? tokens.primary : rate > 0 ? tokens.secondary : 'transparent',
                    opacity: isFuture ? 0.35 : 1,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.day,
                {
                  color: isSelected || isToday ? tokens.primary : tokens.textSecondary,
                  fontWeight: isSelected || isToday ? '800' : '500',
                },
              ]}
            >
              {weekdayShort(weekday).slice(0, 1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  track: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  day: {
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});
