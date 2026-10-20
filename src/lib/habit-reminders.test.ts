/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reminderClock, reminderTriggerCount } from './habit-logic';
import { dateFromHhMm, formatHhMm, formatTimeAmPm, parseHhMm } from './dates';
import type { Habit } from './types';

test('reminderClock parses valid 24-hour time strings and legacy objects', () => {
  assert.deepEqual(reminderClock({ time: '07:30' }), { hour: 7, minute: 30 });
  assert.deepEqual(reminderClock({ time: '00:00' }), { hour: 0, minute: 0 });
  assert.deepEqual(reminderClock({ time: '13:45' }), { hour: 13, minute: 45 });
  assert.deepEqual(reminderClock({ time: '23:59' }), { hour: 23, minute: 59 });
  assert.deepEqual(reminderClock({ hour: 8, minute: 15 }), { hour: 8, minute: 15 });

  // null or invalid reminders return null
  assert.equal(reminderClock(null), null);
  assert.equal(reminderClock(undefined), null);
  assert.equal(reminderClock({ time: 'invalid' }), null);
  assert.equal(reminderClock({ time: '25:00' }), null);
});

test('reminderTriggerCount correctly reflects active notification schedules', () => {
  const baseHabit: Habit = {
    id: 'h-1',
    title: 'Morning Yoga',
    category: 'fitness',
    emoji: '🧘',
    color: '#A6F36A',
    frequency: { type: 'daily' },
    target: 1,
    reminder: { time: '07:00' },
    createdAt: '2026-01-01',
    archived: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Daily reminder triggers once per day (1 trigger)
  assert.equal(reminderTriggerCount(baseHabit), 1);

  // Weekdays habit triggers for each scheduled day (e.g. 3 days = 3 triggers)
  const weekdaysHabit: Habit = {
    ...baseHabit,
    frequency: { type: 'weekdays', days: [1, 3, 5] },
  };
  assert.equal(reminderTriggerCount(weekdaysHabit), 3);

  // Disabled reminder triggers 0 times
  const disabledReminderHabit: Habit = {
    ...baseHabit,
    reminder: null,
  };
  assert.equal(reminderTriggerCount(disabledReminderHabit), 0);
});

test('reminder lifecycle: creation, time edit, and disabling', () => {
  // Step 1: Create habit with 8:00 AM reminder
  let habit: Habit = {
    id: 'h-test',
    title: 'Read Book',
    category: 'learning',
    emoji: '📚',
    color: '#6EC3FF',
    frequency: { type: 'daily' },
    target: 1,
    reminder: { time: '08:00' },
    createdAt: '2026-01-01',
    archived: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(formatTimeAmPm(habit.reminder!.time!), '8:00 AM');
  assert.equal(reminderTriggerCount(habit), 1);

  // Step 2: User opens time picker and updates time to 9:15 PM (21:15)
  const newDate = dateFromHhMm('21:15');
  const formattedNewTime = formatHhMm(newDate.getHours(), newDate.getMinutes());
  assert.equal(formattedNewTime, '21:15');
  assert.equal(formatTimeAmPm(formattedNewTime), '9:15 PM');

  habit = { ...habit, reminder: { time: formattedNewTime } };
  assert.deepEqual(reminderClock(habit.reminder), { hour: 21, minute: 15 });
  assert.equal(reminderTriggerCount(habit), 1);

  // Step 3: User disables the reminder toggle
  habit = { ...habit, reminder: null };
  assert.equal(reminderClock(habit.reminder), null);
  assert.equal(reminderTriggerCount(habit), 0);
});

test('AM/PM time formatting and 24h parser handle edge hours correctly', () => {
  // Midnight (00:00 -> 12:00 AM)
  assert.equal(formatTimeAmPm('00:00'), '12:00 AM');
  assert.deepEqual(parseHhMm('00:00'), { hour: 0, minute: 0 });

  // Noon (12:00 -> 12:00 PM)
  assert.equal(formatTimeAmPm('12:00'), '12:00 PM');
  assert.deepEqual(parseHhMm('12:00'), { hour: 12, minute: 0 });

  // Afternoon (15:30 -> 3:30 PM)
  assert.equal(formatTimeAmPm('15:30'), '3:30 PM');
  assert.deepEqual(parseHhMm('15:30'), { hour: 15, minute: 30 });

  // Late night (23:45 -> 11:45 PM)
  assert.equal(formatTimeAmPm('23:45'), '11:45 PM');
  assert.deepEqual(parseHhMm('23:45'), { hour: 23, minute: 45 });
});
