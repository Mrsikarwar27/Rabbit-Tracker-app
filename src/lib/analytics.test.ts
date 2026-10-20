/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompletionMap, Habit } from './types';
import { dayRates, habitRatesOverDays, monthlySummary, rateForDate, totalHabitDays } from './analytics';

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    title: id,
    category: 'personal',
    emoji: '🌱',
    color: '#A6F36A',
    frequency: { type: 'daily' },
    target: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    archived: false,
    reminder: null,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const K = (d: number) => `2025-03-${String(d).padStart(2, '0')}`;

test('dayRates handles empty everything without crashing', () => {
  const rows = dayRates([], {}, ['2025-03-05'], '2025-03-05');
  assert.deepEqual(rows, [{ dateKey: '2025-03-05', scheduled: 0, completed: 0, rate: 0 }]);
});

test('dayRates computes real percentages', () => {
  const a = habit('a');
  const b = habit('b');
  const completions: CompletionMap = {
    '2025-03-05': { a: { count: 1, updatedAt: 'x' } },
  };
  const [row] = dayRates([a, b], completions, ['2025-03-05'], '2025-03-05');
  assert.equal(row.scheduled, 2);
  assert.equal(row.completed, 1);
  assert.equal(row.rate, 0.5);
});

test('rateForDate matches dayRates', () => {
  const a = habit('a');
  const completions: CompletionMap = { '2025-03-05': { a: { count: 1, updatedAt: 'x' } } };
  assert.deepEqual(rateForDate([a], completions, '2025-03-05').rate, 1);
});

test('monthlySummary clamps to today (future excluded)', () => {
  const a = habit('a');
  const completions: CompletionMap = {
    [K(10)]: { a: { count: 1, updatedAt: 'x' } },
  };
  const summary = monthlySummary([a], completions, 2025, 2, K(10)); // March 2025, today=10th
  assert.equal(summary.days, 10); // only days 1..10 aggregated
  assert.equal(summary.completed, 1);
  assert.equal(summary.scheduled, 10);
  assert.equal(summary.rate, 0.1);
});

test('monthlySummary empty month safe', () => {
  const summary = monthlySummary([], {}, 2025, 0, '2025-01-10');
  assert.equal(summary.rate, 0);
  assert.equal(summary.completed, 0);
});

test('habitRatesOverDays ranks best habits and skips archived', () => {
  const good = habit('good');
  const bad = habit('bad');
  const archived = habit('gone', { archived: true });
  const completions: CompletionMap = {
    [K(1)]: { bad: { count: 1, updatedAt: 'x' } },
  };
  const ranked = habitRatesOverDays([good, bad, archived], completions, [K(1), K(2), K(3)]);
  assert.equal(ranked.length, 2, 'archived habit excluded');
  assert.equal(ranked[0].habit.id, 'bad');
  assert.equal(ranked[0].rate, 1 / 3);
});

test('totalHabitDays counts completed records per habit-day', () => {
  const a = habit('a');
  const b = habit('b', { target: 2 });
  const completions: CompletionMap = {
    [K(1)]: {
      a: { count: 1, updatedAt: 'x' },
      b: { count: 1, updatedAt: 'x' }, // below target -> not counted
    },
    [K(2)]: { b: { count: 2, updatedAt: 'x' } }, // counts
  };
  assert.equal(totalHabitDays([a, b], completions), 2);
});

test('totalHabitDays ignores completions of deleted habits', () => {
  const a = habit('a');
  const completions: CompletionMap = {
    [K(1)]: {
      a: { count: 1, updatedAt: 'x' },
      deleted: { count: 1, updatedAt: 'x' },
    },
  };
  assert.equal(totalHabitDays([a], completions), 1);
});
