import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useHabitStore';
import { dateFromHhMm, formatHhMm, formatTimeAmPm } from '@/lib/dates';
import { getPermissionStatus, requestPermission } from '@/lib/notifications';

export interface ReminderTimePickerProps {
  /** Whether the reminder toggle is on. */
  enabled: boolean;
  /** Callback when the user toggles reminders on/off. */
  onToggleEnabled: (enabled: boolean) => void;
  /** 24h 'HH:MM' time string, e.g. '07:30'. */
  time: string;
  /** Callback when the user selects or updates the time. */
  onTimeChange: (time: string) => void;
  /** Optional master notification setting flag. */
  masterNotificationsEnabled?: boolean;
}

export function ReminderTimePicker({
  enabled,
  onToggleEnabled,
  time,
  onTimeChange,
  masterNotificationsEnabled = true,
}: ReminderTimePickerProps) {
  const { tokens } = useTheme();
  const [showIosModal, setShowIosModal] = useState(false);
  const [tempIosDate, setTempIosDate] = useState<Date>(dateFromHhMm(time || '08:00'));
  const [showWebModal, setShowWebModal] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Check and prompt for permissions when toggled on
  const handleToggle = async (nextValue: boolean) => {
    if (nextValue) {
      // Ensure we have a valid time (default to 8:00 AM if empty)
      if (!time) {
        onTimeChange('08:00');
      }
      onToggleEnabled(true);

      // Verify permission
      try {
        const status = await getPermissionStatus();
        if (!status.granted) {
          const granted = await requestPermission();
          if (!granted) {
            setPermissionDenied(true);
            Alert.alert(
              'Enable Notifications',
              'To receive habit reminders, please allow notifications for Rabbit Tracker in your device Settings.',
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    void Linking.openSettings().catch(() => undefined);
                  },
                },
              ],
            );
          } else {
            setPermissionDenied(false);
          }
        } else {
          setPermissionDenied(false);
        }
      } catch {
        // Non-blocking
      }
    } else {
      onToggleEnabled(false);
      setPermissionDenied(false);
    }
  };

  const openPicker = () => {
    const currentDate = dateFromHhMm(time || '08:00');

    if (Platform.OS === 'android') {
      try {
        DateTimePickerAndroid.open({
          value: currentDate,
          mode: 'time',
          is24Hour: false,
          onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === 'set' && selectedDate) {
              const h = selectedDate.getHours();
              const m = selectedDate.getMinutes();
              onTimeChange(formatHhMm(h, m));
            }
          },
        });
      } catch (err) {
        console.warn('[ReminderTimePicker] DateTimePickerAndroid error:', err);
      }
    } else if (Platform.OS === 'ios') {
      setTempIosDate(currentDate);
      setShowIosModal(true);
    } else {
      // Web fallback modal
      setShowWebModal(true);
    }
  };

  const handleIosConfirm = () => {
    onTimeChange(formatHhMm(tempIosDate.getHours(), tempIosDate.getMinutes()));
    setShowIosModal(false);
  };

  const handleRemove = () => {
    onToggleEnabled(false);
  };

  const displayTime = time ? formatTimeAmPm(time) : '8:00 AM';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.surface,
          borderColor: enabled ? tokens.primary : tokens.border,
        },
      ]}
    >
      {/* ── Toggle row ──────────────────────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <View style={styles.textColumn}>
          <View style={styles.titleWithIcon}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>🔔</Text>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>Set Reminder</Text>
          </View>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            Get a daily alert so you never break your streak
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{
            false: tokens.border,
            true: tokens.primary,
          }}
          thumbColor={enabled ? tokens.onPrimary : tokens.textSecondary}
          accessibilityLabel="Set Reminder toggle"
        />
      </View>

      {/* ── Time button when enabled ────────────────────────────────────────── */}
      {enabled ? (
        <View style={styles.enabledSection}>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={openPicker}
              accessibilityRole="button"
              accessibilityLabel={`Reminder time ${displayTime}. Tap to change time`}
              style={({ pressed }) => [
                styles.timeButton,
                {
                  backgroundColor: tokens.primaryContainer,
                  borderColor: tokens.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>⏰</Text>
              <View style={styles.timeTextWrap}>
                <Text style={[styles.timeLabel, { color: tokens.onPrimaryContainer }]}>
                  Reminder time · {displayTime}
                </Text>
                <Text style={[styles.timeSubtext, { color: tokens.onPrimaryContainer, opacity: 0.8 }]}>
                  Tap to change visually
                </Text>
              </View>
              <Text style={[styles.changeChip, { color: tokens.onPrimaryContainer }]}>✎ Edit</Text>
            </Pressable>

            <Pressable
              onPress={handleRemove}
              accessibilityRole="button"
              accessibilityLabel="Remove reminder"
              hitSlop={8}
              style={({ pressed }) => [
                styles.removeButton,
                {
                  borderColor: tokens.border,
                  backgroundColor: tokens.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.removeLabel, { color: tokens.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {/* Permission warning banner */}
          {permissionDenied ? (
            <Pressable
              onPress={() => {
                void Linking.openSettings().catch(() => undefined);
              }}
              accessibilityRole="button"
              accessibilityLabel="Notifications disabled in Settings. Tap to open Settings"
              style={[
                styles.banner,
                {
                  backgroundColor: tokens.surfaceVariant,
                  borderColor: tokens.warning,
                },
              ]}
            >
              <Text style={styles.bannerIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle, { color: tokens.textPrimary }]}>
                  Notifications are disabled
                </Text>
                <Text style={[styles.bannerText, { color: tokens.textSecondary }]}>
                  Enable notifications in Settings to receive this reminder. Tap here to open Settings.
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Master app switch warning */}
          {!masterNotificationsEnabled ? (
            <View style={[styles.banner, { backgroundColor: tokens.surfaceVariant, borderColor: tokens.border }]}>
              <Text style={styles.bannerIcon}>ℹ️</Text>
              <Text style={[styles.bannerText, { color: tokens.textSecondary, flex: 1 }]}>
                Reminders are currently paused in App Settings. You can re-enable them in the Settings tab.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── iOS Picker Modal ───────────────────────────────────────────────── */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showIosModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIosModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowIosModal(false)} />
            <View style={[styles.iosModalContent, { backgroundColor: tokens.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: tokens.border }]}>
                <Pressable onPress={() => setShowIosModal(false)} hitSlop={8}>
                  <Text style={[styles.modalActionText, { color: tokens.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: tokens.textPrimary }]}>Select Time</Text>
                <Pressable onPress={handleIosConfirm} hitSlop={8}>
                  <Text style={[styles.modalActionText, { color: tokens.primary, fontWeight: '700' }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempIosDate}
                mode="time"
                display="spinner"
                onChange={(_event: DateTimePickerEvent, d?: Date) => {
                  if (d) setTempIosDate(d);
                }}
                textColor={tokens.textPrimary}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* ── Web visual time selector fallback modal ─────────────────────────── */}
      {Platform.OS === 'web' && showWebModal ? (
        <Modal
          visible={showWebModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWebModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowWebModal(false)} />
            <View style={[styles.webModalContent, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Text style={[styles.modalTitle, { color: tokens.textPrimary, marginBottom: 14 }]}>
                Choose Reminder Time
              </Text>
              <WebTimeSelector
                initialTime={time || '08:00'}
                onConfirm={(newTime) => {
                  onTimeChange(newTime);
                  setShowWebModal(false);
                }}
                onCancel={() => setShowWebModal(false)}
                tokens={tokens}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/** Web-friendly interactive clock picker with visual buttons for hour, min, AM/PM */
function WebTimeSelector({
  initialTime,
  onConfirm,
  onCancel,
  tokens,
}: {
  initialTime: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  const parsed = dateFromHhMm(initialTime);
  const rawHour = parsed.getHours();
  const [hour12, setHour12] = useState<number>(rawHour % 12 === 0 ? 12 : rawHour % 12);
  const [minute, setMinute] = useState<number>(parsed.getMinutes());
  const [isPm, setIsPm] = useState<boolean>(rawHour >= 12);

  const apply = () => {
    let finalHour = hour12 % 12;
    if (isPm) finalHour += 12;
    onConfirm(formatHhMm(finalHour, minute));
  };

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <View style={{ width: '100%' }}>
      {/* AM/PM toggle */}
      <View style={styles.webAmPmRow}>
        <Pressable
          onPress={() => setIsPm(false)}
          style={[
            styles.webAmPmBtn,
            {
              backgroundColor: !isPm ? tokens.primary : tokens.surfaceVariant,
              borderColor: tokens.border,
            },
          ]}
        >
          <Text style={{ color: !isPm ? tokens.onPrimary : tokens.textPrimary, fontWeight: '700' }}>
            AM
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsPm(true)}
          style={[
            styles.webAmPmBtn,
            {
              backgroundColor: isPm ? tokens.primary : tokens.surfaceVariant,
              borderColor: tokens.border,
            },
          ]}
        >
          <Text style={{ color: isPm ? tokens.onPrimary : tokens.textPrimary, fontWeight: '700' }}>
            PM
          </Text>
        </Pressable>
      </View>

      {/* Selected time display */}
      <View style={styles.webDisplayTime}>
        <Text style={[styles.webDisplayText, { color: tokens.primary }]}>
          {hour12}:{String(minute).padStart(2, '0')} {isPm ? 'PM' : 'AM'}
        </Text>
      </View>

      {/* Hour selector */}
      <Text style={[styles.webLabel, { color: tokens.textSecondary }]}>HOUR</Text>
      <View style={styles.webGrid}>
        {hours.map((h) => {
          const active = hour12 === h;
          return (
            <Pressable
              key={h}
              onPress={() => setHour12(h)}
              style={[
                styles.webCell,
                {
                  backgroundColor: active ? tokens.primary : tokens.surfaceVariant,
                  borderColor: active ? tokens.primary : tokens.border,
                },
              ]}
            >
              <Text style={{ color: active ? tokens.onPrimary : tokens.textPrimary, fontWeight: '600' }}>
                {h}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Minute selector */}
      <Text style={[styles.webLabel, { color: tokens.textSecondary, marginTop: 12 }]}>MINUTE</Text>
      <View style={styles.webGrid}>
        {minutes.map((m) => {
          const active = minute === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMinute(m)}
              style={[
                styles.webCell,
                {
                  backgroundColor: active ? tokens.primary : tokens.surfaceVariant,
                  borderColor: active ? tokens.primary : tokens.border,
                },
              ]}
            >
              <Text style={{ color: active ? tokens.onPrimary : tokens.textPrimary, fontWeight: '600' }}>
                {String(m).padStart(2, '0')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.webActionRow}>
        <Pressable
          onPress={onCancel}
          style={[styles.webActionBtn, { borderColor: tokens.border }]}
        >
          <Text style={{ color: tokens.textSecondary, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={apply}
          style={[styles.webActionBtn, { backgroundColor: tokens.primary, flex: 1 }]}
        >
          <Text style={{ color: tokens.onPrimary, fontWeight: '700' }}>Set Time</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textColumn: {
    flex: 1,
    paddingRight: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  enabledSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
  },
  timeTextWrap: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  timeSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  changeChip: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeButton: {
    width: 44,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  bannerIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 11,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iosModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalActionText: {
    fontSize: 15,
  },
  webModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  webAmPmRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  webAmPmBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  webDisplayTime: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  webDisplayText: {
    fontSize: 26,
    fontWeight: '800',
  },
  webLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  webGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  webCell: {
    width: '14.5%',
    minWidth: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  webActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
