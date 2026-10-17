import React from 'react';
import { Stack } from 'expo-router';
import { HabitStoreProvider, useHabitStore } from '@/hooks/useHabitStore';

function ThemedStack() {
  const { tokens } = useHabitStore();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen
        name="habit-form"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
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
