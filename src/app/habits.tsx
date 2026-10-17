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
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabitStore } from '@/hooks/useHabitStore';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function Habits() {
  const {
    tokens,
    activeHabits,
    archivedHabits,
    habits,
    hydrated,
    deleteHabit,
    setArchived,
  } = useHabitStore();
  const insets = useSafeAreaInsets();
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Delete habit?', `"${title}" will be removed. Past stats stay intact.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBusyId(id);
          deleteHabit(id)
            .catch(() => undefined)
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  const renderRow = (id: string, emoji: string, title: string, meta: string, archived: boolean) => (
    <View key={id} style={[styles.row, { borderTopColor: tokens.border, opacity: busyId === id ? 0.5 : 1 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: archived ? tokens.muted : tokens.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
          {emoji} {title}
        </Text>
        <Text style={{ color: tokens.sub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push(`/habit-form?id=${id}`)}
        hitSlop={6}
        style={[styles.action, { borderColor: tokens.border, minHeight: 40 }]}
      >
        <Text style={{ color: tokens.sub, fontSize: 12, fontWeight: '700' }}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setBusyId(id);
          setArchived(id, !archived)
            .catch(() => undefined)
            .finally(() => setBusyId(null));
        }}
        hitSlop={6}
        style={[styles.action, { borderColor: archived ? tokens.accent : tokens.border, minHeight: 40 }]}
      >
        <Text style={{ color: archived ? tokens.accent : tokens.sub, fontSize: 12, fontWeight: '700' }}>
          {archived ? 'Restore' : 'Archive'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => confirmDelete(id, title)}
        hitSlop={6}
        style={[styles.action, { borderColor: tokens.danger, minHeight: 40 }]}
      >
        <Text style={{ color: tokens.danger, fontSize: 12, fontWeight: '700' }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const freqMeta = (habit: (typeof habits)[number]): string => {
    const days =
      habit.frequency.type === 'daily'
        ? 'Every day'
        : [...habit.frequency.weekdays]
            .sort((a, b) => a - b)
            .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
            .join(', ');
    const target = habit.target > 1 ? ` · ${habit.target}×/day` : '';
    const reminder = habit.reminder ? ` · ⏰ ${habit.reminder.time}` : '';
    return `${days}${target}${reminder}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <StatusBar barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={tokens.bg} />
      <ScreenHeader title="Manage habits" subtitle={`${activeHabits.length} active · ${archivedHabits.length} archived`} tokens={tokens} showBack />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {!hydrated ? (
          <Text style={{ color: tokens.muted, textAlign: 'center', marginTop: 40 }}>Restoring your data…</Text>
        ) : habits.length === 0 ? (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border, alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ fontSize: 36 }}>🗂️</Text>
            <Text style={{ color: tokens.text, fontSize: 15, fontWeight: '700', marginTop: 8 }}>Nothing here yet</Text>
            <Text style={{ color: tokens.sub, fontSize: 12, marginTop: 4 }}>Create a habit from the home screen + button.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
            <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>ACTIVE ({activeHabits.length})</Text>
            {activeHabits.map((h) => renderRow(h.id, h.emoji, h.title, freqMeta(h), false))}
            {archivedHabits.length > 0 && (
              <Text style={{ color: tokens.sub, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 18 }}>ARCHIVED ({archivedHabits.length})</Text>
            )}
            {archivedHabits.map((h) => renderRow(h.id, h.emoji, h.title, freqMeta(h), true))}
          </View>
        )}

        <Link href="/habit-form" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: tokens.accent,
              borderRadius: 14,
              paddingVertical: 14,
              marginTop: 18,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tokens.onAccent, fontWeight: '800', fontSize: 15 }}>+ New habit</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    minHeight: 56,
  },
  action: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
});
