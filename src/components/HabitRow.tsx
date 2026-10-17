import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Habit } from '@/lib/types';
import type { ThemeTokens } from '@/lib/theme';
import type { CompletionMap } from '@/lib/types';
import { isCompletedOn, currentStreak } from '@/lib/streaks';

type Props = {
  habit: Habit;
  tokens: ThemeTokens;
  completions: CompletionMap;
  dateKey: string;
  onPress: () => void;
  onToggle: () => void;
  onStep: (direction: 1 | -1) => void;
  disabled?: boolean;
};

/** A single habit list row: check circle, title/meta, optional target stepper. */
export function HabitRow({ habit, tokens, completions, dateKey, onPress, onToggle, onStep, disabled }: Props) {
  const count = completions[dateKey]?.[habit.id]?.count ?? 0;
  const done = isCompletedOn(habit, completions, dateKey);
  const streak = currentStreak(habit, completions, dateKey);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 48,
        borderTopWidth: 1,
        borderTopColor: tokens.border,
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        disabled={disabled}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: habit.color,
          backgroundColor: done ? habit.color : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {done && <Text style={{ color: tokens.onAccent ?? tokens.bg, fontSize: 14, fontWeight: '800' }}>✓</Text>}
      </TouchableOpacity>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: done ? tokens.muted : tokens.text,
            fontSize: 15,
            fontWeight: '600',
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {habit.emoji} {habit.title}
        </Text>
        <Text numberOfLines={1} style={{ color: tokens.sub, fontSize: 12, marginTop: 2 }}>
          {habit.target > 1 ? `${count}/${habit.target} · ` : ''}
          {streak > 0 ? `🔥 ${streak} ${streak === 1 ? 'day' : 'days'}` : habit.description || habit.category}
        </Text>
      </View>

      {habit.target > 1 && !done && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => onStep(1)}
            disabled={disabled || count >= habit.target}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: habit.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: habit.color, fontSize: 18, fontWeight: '700' }}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}
