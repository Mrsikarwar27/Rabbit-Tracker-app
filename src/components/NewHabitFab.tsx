import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useHabitStore';

/**
 * Floating "New habit" action.
 *
 * Sits above the bottom navigation and is painted with the live accent.
 */
export function NewHabitFab() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New habit"
      onPress={() => router.push('/habit-form')}
      style={({ pressed }) => [
        styles.fab,
        {
          right: 22,
          bottom: insets.bottom + 82,
          backgroundColor: tokens.primary,
          shadowColor: tokens.primary,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[styles.plus, { color: tokens.onPrimary }]}>+</Text>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: tokens.onPrimary }]}>New Habit</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    height: 56,
    paddingHorizontal: 18,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  plus: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
    marginRight: 6,
  },
  labelWrap: {
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
