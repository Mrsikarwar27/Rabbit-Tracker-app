import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useHabitStore';

interface Tab {
  href: '/' | '/calendar' | '/analytics' | '/settings';
  label: string;
  icon: string;
}

/** Primary destinations, in reference order. */
const TABS: readonly Tab[] = [
  { href: '/', label: 'Home', icon: '☀️' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/analytics', label: 'Insights', icon: '📈' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

/**
 * Bottom navigation.
 *
 * The active destination is derived from the current route, and its colour
 * comes from the theme tokens, so it follows the selected accent instantly.
 */
export function BottomNav() {
  const { tokens } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          paddingBottom: insets.bottom + 8,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Pressable
            key={tab.href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (pathname !== tab.href) {
                router.push(tab.href);
              }
            }}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? tokens.primaryContainer : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 19 }}>{tab.icon}</Text>
            <Text
              style={[
                styles.label,
                { color: active ? tokens.onPrimaryContainer : tokens.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 14,
    marginHorizontal: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
