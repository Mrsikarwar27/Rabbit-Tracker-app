import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Habit, CompletionMap } from '@/lib/types';
import { isCompletedOn, currentStreak } from '@/lib/streaks';
import { useTheme } from '@/hooks/useHabitStore';
import { useRowMetrics } from '@/components/ui';

/**
 * A single habit card in the dashboard list.
 *
 * Icon, name, category, target, optional reminder time and the completion
 * toggle — every colour comes from the theme tokens, so the whole list
 * follows the selected accent.
 */
export function HabitRow({
  habit,
  completions,
  dateKey,
  onPress,
  onToggle,
  onStep,
  disabled,
}: {
  habit: Habit;
  completions: CompletionMap;
  dateKey: string;
  onPress: () => void;
  onToggle: () => void;
  onStep: (direction: 1 | -1) => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const metrics = useRowMetrics();
  const count = completions[dateKey]?.[habit.id]?.count ?? 0;
  const done = isCompletedOn(habit, completions, dateKey);
  const streak = currentStreak(habit, completions, dateKey);
  const reminder = habit.reminder?.time;

  const meta = [
    habit.category.charAt(0).toUpperCase() + habit.category.slice(1),
    habit.target > 1 ? `${count}/${habit.target} done` : null,
    streak > 0 ? `🔥 ${streak}` : null,
    reminder ? `⏰ ${reminder}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}${done ? ', completed' : ''}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: metrics.paddingVertical,
          minHeight: metrics.minHeight,
          borderBottomColor: tokens.border,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Icon tile */}
      <View
        style={[
          styles.iconTile,
          { backgroundColor: tokens.surfaceContainer, borderColor: tokens.border },
        ]}
      >
        <Text style={styles.icon}>{habit.emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: done ? tokens.textSecondary : tokens.textPrimary,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
        >
          {habit.title}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={[styles.meta, { color: tokens.textSecondary }]}>
            {meta}
          </Text>
        ) : null}
      </View>

      {/* Stepper for multi-target habits */}
      {habit.target > 1 && !done && !disabled ? (
        <Pressable
          onPress={() => onStep(1)}
          disabled={count >= habit.target}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${habit.title}`}
          style={[
            styles.stepper,
            { borderColor: tokens.border, backgroundColor: tokens.surfaceContainer },
          ]}
        >
          <Text style={[styles.stepperLabel, { color: tokens.primary }]}>+</Text>
        </Pressable>
      ) : null}

      {/* Completion toggle */}
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Mark ${habit.title} as done`}
        style={[
          styles.check,
          {
            borderColor: done ? tokens.primary : tokens.borderStrong,
            backgroundColor: done ? tokens.primary : 'transparent',
          },
        ]}
      >
        {done ? <Text style={[styles.checkMark, { color: tokens.onPrimary }]}>✓</Text> : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },
  stepper: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepperLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 15,
    fontWeight: '800',
  },
});
