import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompletionMap, Habit } from './types';
import { currentStreak, isScheduledOn, longestStreak } from './streaks';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: 'Test',
    category: 'Personal',
    emoji: '🌱',
    color: '#A6F36A',
    frequency: { type: 'daily' },
    target: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    createdAtKey: '2025-01-01',
    archived: false,
    ...overrides,
  };
}

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function done(map: CompletionMap, h: Habit, dateKey: string): CompletionMap {
  map[dateKey] = map[dateKey] ?? {};
  map[dateKey][h.id] = { count: h.target, updatedAt: `${dateKey}T00:00:00.000Z` };
  return map;
}

test('daily habit scheduled everywhere', () => {
  const h = habit();
  assert.equal(isScheduledOn(h, '2025-03-05'), true);
  const w = habit({ frequency: { type: 'weekdays', weekdays: [1, 3] } });
  assert.equal(isScheduledOn(w, '2025-03-05'), true); // Wednesday = 3
  assert.equal(isScheduledOn(w, '2025-03-06'), false); // Thursday = 4
});

test('current streak: consecutive completed days', () => {
  const h = habit();
  const map = done({}, h, '2025-03-04');
  done(map, h, '2025-03-05');
  done(map, h, '2025-03-06');
  // today = 03-06, completed => streak 3
  assert.equal(currentStreak(h, map, '2025-03-06'), 3);
});

test('current streak: uncompleted today is pending, not a break', () => {
  const h = habit({ createdAtKey: '2025-03-01' });
  const map = done({}, h, '2025-03-04');
  done(map, h, '2025-03-05');
  // today = 03-06 not completed => streak continues counting yesterday chain = 2
  assert.equal(currentStreak(h, map, '2025-03-06'), 2);
});

test('current streak: missed scheduled past day breaks it', () => {
  const h = habit({ createdAtKey: '2025-03-01' });
  const map = done({}, h, '2025-03-04');
  done(map, h, '2025-03-05');
  // today = 03-07, and 03-06 (past, scheduled, missed) breaks
  assert.equal(currentStreak(h, map, '2025-03-07'), 0);
});

test('current streak: non-scheduled days never break (weekdays habit)', () => {
  // Weekdays: Mon(1), Wed(3) only. 2025-03-04 is Tuesday.
  const h = habit({ frequency: { type: 'weekdays', weekdays: [1, 3] }, createdAtKey: '2025-03-01' });
  const map = done({}, h, '2025-03-03'); // Monday done
  // Tuesday 03-04 not scheduled -> doesn't break. Wednesday 03-05 done.
  done(map, h, '2025-03-05');
  // today = Wednesday 03-05 completed => streak 2
  assert.equal(currentStreak(h, map, '2025-03-05'), 2);
  // Thursday 03-06: today not completed, pending; last completed scheduled = Wed => 2
  assert.equal(currentStreak(h, map, '2025-03-06'), 2);
});

test('current streak: zero before habit creation', () => {
  const h = habit({ createdAtKey: '2025-03-01' });
  const map = done({}, h, '2025-02-28'); // predates habit
  assert.equal(currentStreak(h, map, '2025-03-01'), 0);
});

test('longest streak counts historical run; today pending does not break max', () => {
  const h = habit({ createdAtKey: '2025-01-01' });
  const map = done({}, h, '2025-01-10');
  done(map, h, '2025-01-11');
  done(map, h, '2025-01-12');
  // gap on 01-13 (missed), run of 2 elsewhere? Actually run = 3 consecutive 10-12.
  assert.equal(longestStreak(h, map, '2025-01-20'), 3);
});

test('longest streak: historical missed day splits runs', () => {
  const h = habit({ createdAtKey: '2025-01-01' });
  const map = done({}, h, '2025-01-01');
  done(map, h, '2025-01-02');
  done(map, h, '2025-01-04');
  done(map, h, '2025-01-05');
  done(map, h, '2025-01-06');
  // 01-03 missed => best run is 3 (04-06)
  assert.equal(longestStreak(h, map, '2025-01-10'), 3);
  // current streak at 01-10: 01-07..01-10 all scheduled/missed -> 0
  assert.equal(currentStreak(h, map, '2025-01-10'), 0);
});

test('target > 1: completion only when count reaches target', () => {
  const h = habit({ target: 3, createdAtKey: '2025-01-01' });
  const map: CompletionMap = {
    '2025-01-05': { [h.id]: { count: 2, updatedAt: 'x' } },
  };
  assert.equal(isScheduledOn(h, '2025-01-05'), true);
  // count 2 < target 3 => not completed => streak 0 (past missed)
  assert.equal(currentStreak(h, map, '2025-01-06'), 0);
  map['2025-01-05'][h.id] = { count: 3, updatedAt: 'x' };
  assert.equal(currentStreak(h, map, '2025-01-05'), 1);
});
