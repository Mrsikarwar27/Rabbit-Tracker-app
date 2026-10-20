import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { HabitStoreProvider, useTheme } from '@/hooks/useHabitStore';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error?.message || String(error)}</Text>
      <Pressable onPress={retry} style={styles.retryButton}>
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

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

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#121212',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#A6F36A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
});

