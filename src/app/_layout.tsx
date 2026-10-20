import React from 'react';
import { Stack } from 'expo-router';
import { HabitStoreProvider, useTheme } from '@/hooks/useHabitStore';

function ThemedStack() {
  const { tokens, appearance } = useTheme();
  // The "reduced motion" preference genuinely disables screen animations.
  const reduced = appearance.reducedMotion;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
        animation: reduced ? 'none' : 'fade',
      }}
    >
      <Stack.Screen
        name="habit-form"
        options={{
          presentation: 'modal',
          animation: reduced ? 'none' : 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <HabitStoreProvider>
      <ThemedStack />
    </HabitStoreProvider>
  );
}
