import React, { useState } from 'react';
import {
  Alert,
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
import { Card, PrimaryButton, SectionLabel } from '@/components/ui';

export default function Habits() {
  const {
    activeHabits,
    archivedHabits,
    habits,
    hydrated,
    deleteHabit,
    setArchived,
  } = useHabitStore();
  const { tokens } = useTheme();
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
      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: archived ? tokens.textTertiary : tokens.textPrimary }]}
          numberOfLines={1}
        >
          {emoji} {title}
        </Text>
        <Text style={[styles.rowMeta, { color: tokens.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text
        role="button"
        onPress={() => router.push(`/habit-form?id=${id}`)}
        suppressHighlighting
        style={[
          styles.action,
          {
            color: tokens.textSecondary,
            borderColor: tokens.border,
            backgroundColor: tokens.surfaceContainer,
          },
        ]}
      >
        Edit
      </Text>
      <Text
        role="button"
        onPress={() => {
          setBusyId(id);
          setArchived(id, !archived)
            .catch(() => undefined)
            .finally(() => setBusyId(null));
        }}
        suppressHighlighting
        style={[
          styles.action,
          {
            color: archived ? tokens.primary : tokens.textSecondary,
            borderColor: archived ? tokens.primary : tokens.border,
            backgroundColor: tokens.surfaceContainer,
          },
        ]}
      >
        {archived ? 'Restore' : 'Archive'}
      </Text>
      <Text
        role="button"
        onPress={() => confirmDelete(id, title)}
        suppressHighlighting
        style={[
          styles.action,
          { color: tokens.error, borderColor: tokens.error, backgroundColor: tokens.surfaceContainer },
        ]}
      >
        Delete
      </Text>
    </View>
  );

  const freqMeta = (habit: (typeof habits)[number]): string => {
    const days =
      habit.frequency.type === 'daily'
        ? 'Every day'
        : (habit.frequency as { type: 'weekdays'; days: number[] }).days
            .sort((a, b) => a - b)
            .map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
            .join(', ');
    const target = habit.target > 1 ? ` · ${habit.target}×/day` : '';
    const reminderTimeStr = (habit.reminder as { time?: string })?.time || '';
    const reminderStr = reminderTimeStr ? ` · ⏰ ${reminderTimeStr}` : '';
    return `${days}${target}${reminderStr}`;
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScreenHeader
        title="Manage habits"
        subtitle={`${activeHabits.length} active · ${archivedHabits.length} archived`}
        showBack
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hydrated ? (
          <Text style={[styles.loading, { color: tokens.textTertiary }]}>Restoring your data…</Text>
        ) : habits.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🗂️</Text>
            <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>Nothing here yet</Text>
            <Text style={[styles.emptyText, { color: tokens.textSecondary }]}>
              Create a habit from the home screen + button.
            </Text>
          </Card>
        ) : (
          <Card style={styles.card}>
            <SectionLabel>ACTIVE ({activeHabits.length})</SectionLabel>
            {activeHabits.map((h) => renderRow(h.id, h.emoji, h.title, freqMeta(h), false))}
            {archivedHabits.length > 0 ? (
              <SectionLabel style={styles.archivedLabel}>
                ARCHIVED ({archivedHabits.length})
              </SectionLabel>
            ) : null}
            {archivedHabits.map((h) => renderRow(h.id, h.emoji, h.title, freqMeta(h), true))}
          </Card>
        )}

        <PrimaryButton
          label="New habit"
          icon="+"
          onPress={() => router.push('/habit-form')}
          style={styles.newButton}
        />
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
  loading: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyCard: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    minHeight: 58,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  action: {
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  archivedLabel: {
    marginTop: 18,
  },
  newButton: {
    marginTop: 18,
  },
});
