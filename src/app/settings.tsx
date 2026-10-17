import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { ScreenHeader } from '@/components/ScreenHeader';
import { requestPermission } from '@/lib/notifications';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function Settings() {
  const {
    tokens,
    settings,
    updateSettings,
    notificationStatus,
    refreshNotificationStatus,
    habits,
    exportData,
    clearAllData,
  } = useHabitStore();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const sector = (label: string, options: Array<{ value: string; label: string }>, value: string, onPick: (v: string) => void) => (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.value}
            onPress={() => onPick(o.value)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              minHeight: 46,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: value === o.value ? tokens.accent : tokens.border,
              backgroundColor: value === o.value ? tokens.card : tokens.bg,
            }}
          >
            <Text style={{ color: value === o.value ? tokens.accent : tokens.sub, fontSize: 13, fontWeight: '700' }}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const toggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      // Turning ON: request permission if needed, then enable.
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

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.bg}
      />
      <ScreenHeader title="Settings" subtitle="Personalize and manage your data" tokens={tokens} showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 36 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>APPEARANCE</Text>
          {sector(
            'Theme',
            [
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ],
            settings.theme,
            (v) => updateSettings({ theme: v as 'dark' | 'light' | 'system' }),
          )}
          {sector(
            'Week starts on',
            [
              { value: 'sun', label: 'Sunday' },
              { value: 'mon', label: 'Monday' },
            ],
            settings.weekStart,
            (v) => updateSettings({ weekStart: v as 'sun' | 'mon' }),
          )}
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>REMINDERS</Text>
          <TouchableOpacity
            onPress={() => {
              void toggleNotifications();
            }}
            disabled={busy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              marginTop: 8,
              minHeight: 48,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: tokens.text, fontSize: 15, fontWeight: '600' }}>Habit reminders</Text>
              <Text style={{ color: tokens.sub, fontSize: 12, marginTop: 2 }}>
                {settings.notificationsEnabled ? statusText : 'Off'}
              </Text>
            </View>
            <View
              style={{
                width: 52,
                height: 30,
                borderRadius: 15,
                backgroundColor: settings.notificationsEnabled ? tokens.accent : tokens.border,
                padding: 3,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: tokens.mode === 'dark' ? '#101114' : '#FFFFFF',
                  transform: [{ translateX: settings.notificationsEnabled ? 22 : 0 }],
                }}
              />
            </View>
          </TouchableOpacity>
          <Text style={{ color: tokens.muted, fontSize: 11, marginTop: 6 }}>
            Per-habit reminder times live in each habit's form. On Android in Expo Go, exact delivery can be
            delayed by battery optimization (Doze).
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>DATA</Text>
          <Text style={{ color: tokens.sub, fontSize: 12, marginTop: 8 }}>
            {habits.length} habit{habits.length === 1 ? '' : 's'} stored locally on this device.
          </Text>
          <TouchableOpacity
            onPress={() => {
              void exportJson();
            }}
            disabled={busy}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              marginTop: 12,
              minHeight: 46,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '700' }}>Export data as JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmClearData}
            disabled={busy}
            style={{
              borderWidth: 1,
              borderColor: tokens.danger,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              marginTop: 10,
              minHeight: 46,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tokens.danger, fontSize: 13, fontWeight: '700' }}>Clear all data…</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: tokens.muted, fontSize: 11, textAlign: 'center', marginTop: 26 }}>
          HabitTracker · runs fully offline
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 18 },
});
