/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dateFromHhMm,
  formatHhMm,
  formatTimeAmPm,
  isValidDateKey,
  localDateKey,
  parseDateKey,
  parseHhMm,
  startOfWeekKey,
  weekdayOf,
} from './dates';

test('localDateKey uses local calendar, not UTC', () => {
  // 2024-01-01 00:30 IST == 2023-12-31 19:00 UTC. Must stay Jan 1 locally.
  const date = new Date(2024, 0, 1, 0, 30);
  assert.equal(localDateKey(date), '2024-01-01');
});

test('localDateKey pads month and day', () => {
  assert.equal(localDateKey(new Date(2025, 2, 5)), '2025-03-05');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(localDateKey(addDays(new Date(2024, 0, 31), 1)), '2024-02-01');
  assert.equal(localDateKey(addDays(new Date(2024, 1, 29), 1)), '2024-03-01'); // leap year
  assert.equal(localDateKey(addDays(new Date(2024, 11, 31), 1)), '2025-01-01');
  assert.equal(localDateKey(addDays(new Date(2024, 5, 10), -10)), '2024-05-31');
});

test('parseDateKey is a local midnight date', () => {
  const date = parseDateKey('2025-07-04');
  assert.equal(date.getFullYear(), 2025);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 4);
  assert.equal(date.getHours(), 0);
});

test('round-trip parse/format is stable', () => {
  assert.equal(localDateKey(parseDateKey('2025-12-31')), '2025-12-31');
});

test('isValidDateKey rejects malformed keys', () => {
  assert.equal(isValidDateKey('2025-02-29'), false, '2025 not a leap year');
  assert.equal(isValidDateKey('2024-02-29'), true, 'leap year ok');
  assert.equal(isValidDateKey('2024-13-01'), false);
  assert.equal(isValidDateKey('2024-00-10'), false);
  assert.equal(isValidDateKey('2024-01-00'), false);
  assert.equal(isValidDateKey('2024-1-01'), false, 'must be padded');
  assert.equal(isValidDateKey('garbage'), false);
  assert.equal(isValidDateKey(42), false);
  assert.equal(isValidDateKey('2024-04-31'), false, 'April has 30 days');
});

test('weekdayOf matches JS getDay convention (0=Sunday)', () => {
  assert.equal(weekdayOf('2025-02-09'), 0); // Sunday
  assert.equal(weekdayOf('2025-02-10'), 1); // Monday
  assert.equal(weekdayOf('2025-02-15'), 6); // Saturday
});

test('startOfWeekKey honors week-start preference', () => {
  const wed = '2025-02-12'; // Wednesday
  assert.equal(startOfWeekKey(wed, 'mon'), '2025-02-10'); // Monday
  assert.equal(startOfWeekKey(wed, 'sun'), '2025-02-09'); // Sunday
  // Sunday with mon-start belongs to previous week.
  assert.equal(startOfWeekKey('2025-02-09', 'mon'), '2025-02-03');
  // Monday with sun-start belongs to that same day's week starting Sunday prior.
  assert.equal(startOfWeekKey('2025-02-10', 'sun'), '2025-02-09');
});

test('parseHhMm and formatHhMm convert 24h times accurately', () => {
  assert.deepEqual(parseHhMm('07:30'), { hour: 7, minute: 30 });
  assert.deepEqual(parseHhMm('00:00'), { hour: 0, minute: 0 });
  assert.deepEqual(parseHhMm('23:59'), { hour: 23, minute: 59 });
  assert.equal(parseHhMm('24:00'), null);
  assert.equal(parseHhMm('invalid'), null);
  assert.equal(formatHhMm(7, 30), '07:30');
  assert.equal(formatHhMm(0, 5), '00:05');
  assert.equal(formatHhMm(23, 59), '23:59');
});

test('formatTimeAmPm produces user-friendly 12-hour strings', () => {
  assert.equal(formatTimeAmPm('07:30'), '7:30 AM');
  assert.equal(formatTimeAmPm('00:00'), '12:00 AM');
  assert.equal(formatTimeAmPm('12:00'), '12:00 PM');
  assert.equal(formatTimeAmPm('13:45'), '1:45 PM');
  assert.equal(formatTimeAmPm('23:59'), '11:59 PM');
  assert.equal(formatTimeAmPm({ hour: 9, minute: 5 }), '9:05 AM');
  assert.equal(formatTimeAmPm({ hour: 21, minute: 30 }), '9:30 PM');
  assert.equal(formatTimeAmPm(''), '');
});

test('dateFromHhMm initializes Date with specified hour and minute', () => {
  const d = dateFromHhMm('14:30');
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 30);
  const fallback = dateFromHhMm(undefined, 8, 15);
  assert.equal(fallback.getHours(), 8);
  assert.equal(fallback.getMinutes(), 15);
});

