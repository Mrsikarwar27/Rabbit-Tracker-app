import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore, useTheme } from '@/hooks/useHabitStore';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, OutlineButton, SectionLabel } from '@/components/ui';
import { requestPermission } from '@/lib/notifications';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function Settings() {
  const {
    settings,
    updateSettings,
    notificationStatus,
    refreshNotificationStatus,
    habits,
    exportData,
    clearAllData,
  } = useHabitStore();
  const { tokens, accent, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const toggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      const granted = await requestPermission();
      await refreshNotificationStatus();
      if (!granted) {
        Alert.alert(
          'Notifications unavailable',
          'Permission was not granted. You can enable it later in Android system settings → Apps → Expo Go → Notifications.',
        );
        return;
      }
      updateSettings({ notificationsEnabled: true });
    } else {
      updateSettings({ notificationsEnabled: false });
    }
  };

  const exportJson = async () => {
    setBusy(true);
    try {
      const json = JSON.stringify(exportData(), null, 2);
      const file = new File(Paths.cache, 'habit-tracker-export.json');
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Export ready', `Saved to ${file.uri}`);
      }
    } catch (error) {
      console.warn('[settings] export failed:', error);
      Alert.alert('Export failed', 'Could not create the export file on this device.');
    } finally {
      setBusy(false);
    }
  };

  const confirmClearData = () => {
    Alert.alert(
      'Clear all data?',
      'This permanently deletes every habit, completion record and setting on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            clearAllData()
              .catch(() => undefined)
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const statusText =
    notificationStatus === 'granted'
      ? 'Permission granted ✓'
      : notificationStatus === 'denied'
        ? 'Permission denied — enable in system settings'
        : 'Not requested yet';

  const modeLabel = mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light';

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScreenHeader title="Settings" subtitle="Personalize and manage your data" showBack />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Appearance ─────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>APPEARANCE</SectionLabel>
          <Pressable
            onPress={() => router.push('/appearance')}
            accessibilityRole="button"
            accessibilityLabel="Open appearance settings"
            style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.swatch, { backgroundColor: accent }]} />
            <View style={styles.linkText}>
              <Text style={[styles.linkTitle, { color: tokens.textPrimary }]}>Theme & colours</Text>
              <Text style={[styles.linkCaption, { color: tokens.textSecondary }]}>
                {modeLabel} mode · {accent.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: tokens.textSecondary }]}>›</Text>
          </Pressable>
        </Card>

        {/* ── Reminders ──────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>REMINDERS</SectionLabel>
          <Pressable
            onPress={() => {
              void toggleNotifications();
            }}
            disabled={busy}
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.notificationsEnabled }}
            accessibilityLabel="Habit reminders"
            style={styles.switchRow}
          >
            <View style={styles.switchText}>
              <Text style={[styles.linkTitle, { color: tokens.textPrimary }]}>Habit reminders</Text>
              <Text style={[styles.linkCaption, { color: tokens.textSecondary }]}>
                {settings.notificationsEnabled ? statusText : 'Off'}
              </Text>
            </View>
            <View
              style={[
                styles.switch,
                {
                  backgroundColor: settings.notificationsEnabled ? tokens.primary : tokens.surfaceContainer,
                  borderColor: settings.notificationsEnabled ? tokens.primary : tokens.borderStrong,
                },
              ]}
            >
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: settings.notificationsEnabled ? tokens.onPrimary : tokens.textSecondary,
                    transform: [{ translateX: settings.notificationsEnabled ? 22 : 0 }],
                  },
                ]}
              />
            </View>
          </Pressable>
          <Text style={[styles.footnote, { color: tokens.textTertiary }]}>
            Per-habit reminder times live in each habit&apos;s form. On Android in Expo Go, exact
            delivery can be delayed by battery optimization (Doze).
          </Text>
        </Card>

        {/* ── Data ───────────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>DATA</SectionLabel>
          <Text style={[styles.body, { color: tokens.textSecondary }]}>
            {habits.length} habit{habits.length === 1 ? '' : 's'} stored locally on this device.
          </Text>
          <OutlineButton
            label="Export data as JSON"
            onPress={() => {
              void exportJson();
            }}
            disabled={busy}
            style={styles.action}
          />
          <OutlineButton
            label="Clear all data…"
            tone="danger"
            onPress={confirmClearData}
            disabled={busy}
            style={styles.action}
          />
        </Card>

        <View style={styles.footerWrap}>
          <Image
            source={require('../../assets/images/rabbit-logo.png')}
            style={styles.footerLogo}
          />
          <Text style={[styles.footerTitle, { color: tokens.textPrimary }]}>
            Rabbit Tracker
          </Text>
          <Text style={[styles.footer, { color: tokens.textTertiary }]}>
            v1.0.0 · runs fully offline
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    marginTop: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    minHeight: 56,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 13,
    marginRight: 12,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkCaption: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    minHeight: 56,
  },
  switchText: {
    flex: 1,
    paddingRight: 12,
  },
  switch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  footnote: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  body: {
    fontSize: 13,
    marginTop: 10,
  },
  action: {
    marginTop: 12,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 16,
  },
  footerLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: 8,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
