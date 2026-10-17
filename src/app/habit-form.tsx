import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { CATEGORIES, type Category, type HabitInput } from '@/lib/types';
import { CATEGORY_EMOJI, PALETTE, type ThemeTokens } from '@/lib/theme';
import { parseHhMm, weekdayLong, weekdayOrder } from '@/lib/dates';

const fieldLabel = (tokens: ThemeTokens): StyleSheet.NamedStyles<{ label: {} }> =>
  StyleSheet.create({
    label: { color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  });

export default function HabitForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : undefined;
  const { tokens, getHabit, addHabit, updateHabit, deleteHabit } = useHabitStore();
  const existing = getHabit(editId);
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const labels = fieldLabel(tokens);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'Personal');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🌱');
  const [color, setColor] = useState(existing?.color ?? PALETTE[0]);
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekdays'>(
    existing?.frequency.type === 'weekdays' ? 'weekdays' : 'daily',
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.frequency.type === 'weekdays' ? existing.frequency.weekdays : [],
  );
  const [target, setTarget] = useState(String(existing?.target ?? 1));
  const [reminderTime, setReminderTime] = useState(existing?.reminder?.time ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emojiChoices = useMemo(() => CATEGORY_EMOJI[category] ?? CATEGORY_EMOJI.Personal, [category]);

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
    Alert.alert('Delete habit?', `"${existing.title}" and its reminders will be removed. Your past stats stay intact.`, [
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
    ]);
  };

  const toggleWeekday = (wd: number) => {
    setWeekdays((prev) => (prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd]));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.bg }}
    >
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.bg}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
            <Text style={{ color: tokens.sub, fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ color: tokens.text, fontSize: 22, fontWeight: '800' }}>
            {existing ? 'Edit habit' : 'New habit'}
          </Text>
        </View>

        <Text style={labels.label}>NAME</Text>
        <View style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
          <TextInput
            style={{ color: tokens.text, fontSize: 15, flex: 1 }}
            placeholder="e.g. Drink water"
            placeholderTextColor={tokens.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
        </View>

        <Text style={[labels.label, { marginTop: 14 }]}>DESCRIPTION (OPTIONAL)</Text>
        <View style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border, minHeight: 64 }]}>
          <TextInput
            style={{ color: tokens.text, fontSize: 15, flex: 1, paddingVertical: 10 }}
            placeholder="Why does it matter?"
            placeholderTextColor={tokens.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={140}
          />
        </View>

        <Text style={[labels.label, { marginTop: 14 }]}>CATEGORY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 40,
                justifyContent: 'center',
                borderColor: category === c ? tokens.accent : tokens.border,
                backgroundColor: category === c ? tokens.accent : tokens.card,
              }}
            >
              <Text style={{ color: category === c ? tokens.onAccent : tokens.sub, fontSize: 13, fontWeight: '600' }}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[labels.label, { marginTop: 16 }]}>ICON</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {emojiChoices.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => setEmoji(e)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: emoji === e ? tokens.accent : tokens.border,
                backgroundColor: tokens.card,
              }}
            >
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[labels.label, { marginTop: 16 }]}>ACCENT COLOR</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          {PALETTE.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c,
                borderWidth: 3,
                borderColor: color === c ? tokens.text : 'transparent',
              }}
            />
          ))}
        </View>

        <Text style={[labels.label, { marginTop: 16 }]}>FREQUENCY</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(['daily', 'weekdays'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFrequencyType(f)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 46,
                justifyContent: 'center',
                alignItems: 'center',
                borderColor: frequencyType === f ? tokens.accent : tokens.border,
                backgroundColor: frequencyType === f ? tokens.card : tokens.bg,
              }}
            >
              <Text style={{ color: frequencyType === f ? tokens.accent : tokens.sub, fontSize: 13, fontWeight: '700' }}>
                {f === 'daily' ? 'Every day' : 'Pick days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {frequencyType === 'weekdays' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {weekdayOrder('sun').map((wd) => (
              <TouchableOpacity
                key={wd}
                onPress={() => toggleWeekday(wd)}
                style={{
                  width: 44,
                  height: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: weekdays.includes(wd) ? tokens.accent : tokens.border,
                  backgroundColor: weekdays.includes(wd) ? tokens.card : tokens.bg,
                }}
              >
                <Text style={{ color: weekdays.includes(wd) ? tokens.accent : tokens.sub, fontSize: 12, fontWeight: '700' }}>
                  {weekdayLong(wd).slice(0, 2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 0.55 }}>
            <Text style={labels.label}>DAILY TARGET</Text>
            <View style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <TextInput
                style={{ color: tokens.text, fontSize: 15, flex: 1 }}
                value={target}
                onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labels.label}>REMINDER (24H, OPTIONAL)</Text>
            <View style={[styles.input, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <TextInput
                style={{ color: tokens.text, fontSize: 15, flex: 1 }}
                placeholder="07:30"
                placeholderTextColor={tokens.muted}
                value={reminderTime}
                onChangeText={(text) => setReminderTime(text.replace(/[^0-9:]/g, ''))}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {error ? <Text style={{ color: tokens.danger, fontSize: 13, marginTop: 14 }}>⚠️ {error}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          <TouchableOpacity
            onPress={save}
            disabled={busy}
            style={{
              flex: 1,
              backgroundColor: tokens.accent,
              borderRadius: 14,
              paddingVertical: 14,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ color: tokens.onAccent, fontWeight: '800', fontSize: 15 }}>
              {existing ? 'Save changes' : 'Create habit'}
            </Text>
          </TouchableOpacity>
          {existing ? (
            <TouchableOpacity
              onPress={confirmDelete}
              disabled={busy}
              style={{
                width: 76,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.danger,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: tokens.danger, fontSize: 13, fontWeight: '700' }}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 8,
    minHeight: 46,
    justifyContent: 'center',
  },
});
