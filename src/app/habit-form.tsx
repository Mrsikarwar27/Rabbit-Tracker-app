import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore, useTheme } from '@/hooks/useHabitStore';
import { CATEGORIES, getCategoryMeta, type Category, type HabitInput } from '@/lib/types';
import { CATEGORY_EMOJI, PALETTE } from '@/lib/theme';
import { parseHhMm, weekdayLong, weekdayOrder } from '@/lib/dates';

export default function HabitForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const { getHabit, addHabit, updateHabit, deleteHabit } = useHabitStore();
  const { tokens } = useTheme();
  const existing = getHabit(editId);
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<Category>(
    existing ? existing.category : 'personal',
  );
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🌱');
  const [color, setColor] = useState(existing?.color ?? PALETTE[0]);
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekdays'>(
    existing?.frequency.type === 'weekdays' ? 'weekdays' : 'daily',
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.frequency.type === 'weekdays' ? (existing.frequency as { days: number[] }).days : [],
  );
  const [target, setTarget] = useState(String(existing?.target ?? 1));
  const [reminderTime, setReminderTime] = useState(existing?.reminder?.time ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emojiChoices = useMemo(() => CATEGORY_EMOJI[category] ?? CATEGORY_EMOJI.personal, [category]);

  const validate = (): string | null => {
    if (!title.trim()) return 'Give your habit a name';
    if (frequencyType === 'weekdays' && weekdays.length === 0) return 'Pick at least one weekday';
    const t = parseInt(target || '0', 10);
    if (!Number.isInteger(t) || t < 1 || t > 99) return 'Daily target must be 1–99';
    if (reminderTime.trim() && !parseHhMm(reminderTime))
      return 'Reminder must be HH:MM, 24-hour (e.g. 07:30)';
    return null;
  };

  const buildInput = (): HabitInput => ({
    title: title.trim(),
    description: description.trim(),
    category,
    emoji,
    color,
    frequencyType,
    weekdays,
    target: parseInt(target || '0', 10),
    reminderTime: reminderTime.trim(),
  });

  const save = async () => {
    setError(null);
    if (savingRef.current) return; // duplicate-submission guard
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const input = buildInput();
      const ok = existing
        ? await updateHabit(existing.id, input)
        : (await addHabit(input)) !== null;
      if (ok) router.back();
      else setError('Could not save. Check the values and try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete habit?',
      `"${existing.title}" and its reminders will be removed. Your past stats stay intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            deleteHabit(existing.id)
              .then(() => router.back())
              .catch(() => setError('Could not delete. Please try again.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const toggleWeekday = (wd: number) => {
    setWeekdays((prev) => (prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd]));
  };

  const field = (label: string, extra?: object) => (
    <Text style={[styles.label, { color: tokens.textSecondary }, extra]}>{label}</Text>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: tokens.background }]}
    >
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Text style={[styles.backLabel, { color: tokens.primary }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {existing ? 'Edit habit' : 'New habit'}
          </Text>
        </View>

        {field('NAME')}
        <View
          style={[
            styles.input,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <TextInput
            style={{ color: tokens.textPrimary, fontSize: 15, flex: 1 }}
            placeholder="e.g. Drink water"
            placeholderTextColor={tokens.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
        </View>

        {field('DESCRIPTION (OPTIONAL)', { marginTop: 16 })}
        <View
          style={[
            styles.input,
            { backgroundColor: tokens.surface, borderColor: tokens.border, minHeight: 64 },
          ]}
        >
          <TextInput
            style={{ color: tokens.textPrimary, fontSize: 15, flex: 1, paddingVertical: 10 }}
            placeholder="Why does it matter?"
            placeholderTextColor={tokens.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={140}
          />
        </View>

        {field('CATEGORY', { marginTop: 16 })}
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.pill,
                  {
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: active ? tokens.primary : tokens.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? tokens.onPrimary : tokens.textSecondary,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {getCategoryMeta(c).emoji} {getCategoryMeta(c).label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {field('ICON', { marginTop: 18 })}
        <View style={styles.chipRow}>
          {emojiChoices.map((e) => {
            const active = emoji === e;
            return (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Icon ${e}`}
                style={[
                  styles.iconBox,
                  {
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>

        {field('COLOUR', { marginTop: 18 })}
        <View style={styles.swatchRow}>
          {PALETTE.map((c) => {
            const active = color.toUpperCase() === c.toUpperCase();
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Colour ${c}`}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: active ? tokens.textPrimary : 'transparent',
                    borderWidth: active ? 3 : 0,
                  },
                ]}
              />
            );
          })}
        </View>

        {field('FREQUENCY', { marginTop: 18 })}
        <View style={styles.chipRow}>
          {(['daily', 'weekdays'] as const).map((f) => {
            const active = frequencyType === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFrequencyType(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.pill,
                  styles.grow,
                  {
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: active ? tokens.primaryContainer : tokens.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? tokens.onPrimaryContainer : tokens.textSecondary,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {f === 'daily' ? 'Every day' : 'Pick days'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {frequencyType === 'weekdays' ? (
          <View style={styles.chipRow}>
            {weekdayOrder('sun').map((wd) => {
              const active = weekdays.includes(wd);
              return (
                <Pressable
                  key={wd}
                  onPress={() => toggleWeekday(wd)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.weekdayBox,
                    {
                      borderColor: active ? tokens.primary : tokens.border,
                      backgroundColor: active ? tokens.primaryContainer : tokens.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? tokens.onPrimaryContainer : tokens.textSecondary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {weekdayLong(wd).slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.splitRow}>
          <View style={styles.splitLeft}>
            {field('DAILY TARGET')}
            <View
              style={[
                styles.input,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <TextInput
                style={{ color: tokens.textPrimary, fontSize: 15, flex: 1 }}
                value={target}
                onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <View style={styles.splitRight}>
            {field('REMINDER (24H, OPTIONAL)')}
            <View
              style={[
                styles.input,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <TextInput
                style={{ color: tokens.textPrimary, fontSize: 15, flex: 1 }}
                placeholder="07:30"
                placeholderTextColor={tokens.textTertiary}
                value={reminderTime}
                onChangeText={(text) => setReminderTime(text.replace(/[^0-9:]/g, ''))}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {error ? (
          <Text style={[styles.error, { color: tokens.error }]}>⚠️ {error}</Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={existing ? 'Save changes' : 'Create habit'}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: tokens.primary,
                opacity: busy ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: tokens.onPrimary }]}>
              {existing ? 'Save changes' : 'Create habit'}
            </Text>
          </Pressable>
          {existing ? (
            <Pressable
              onPress={confirmDelete}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Delete habit"
              style={[styles.deleteBtn, { borderColor: tokens.error }]}
            >
              <Text style={[styles.deleteLabel, { color: tokens.error }]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  backLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  weekdayBox: {
    width: 44,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  splitLeft: {
    flex: 0.55,
  },
  splitRight: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    marginTop: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 15,
    paddingVertical: 15,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontWeight: '800',
    fontSize: 15,
  },
  deleteBtn: {
    width: 80,
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
