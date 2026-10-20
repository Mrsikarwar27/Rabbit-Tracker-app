import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useHabitStore';

/**
 * Screen header with an optional back affordance.
 * Colours come from the theme tokens so headers follow the accent.
 */
export function ScreenHeader({
  title,
  subtitle,
  showBack,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 14, backgroundColor: tokens.background }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={() => {
              if (router.canGoBack && router.canGoBack()) router.back();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.back,
              {
                borderColor: tokens.border,
                backgroundColor: tokens.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.backLabel, { color: tokens.textPrimary }]}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: tokens.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
});
