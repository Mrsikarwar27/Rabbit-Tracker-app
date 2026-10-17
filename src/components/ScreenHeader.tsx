import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { ThemeTokens } from '@/lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  tokens: ThemeTokens;
  showBack?: boolean;
};

/** Consistent screen header with optional back button, safe-area aware. */
export function ScreenHeader({ title, subtitle, tokens, showBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, backgroundColor: tokens.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: tokens.text, fontSize: 17 }}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: tokens.text, fontSize: 26, fontWeight: '800' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: tokens.sub, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
