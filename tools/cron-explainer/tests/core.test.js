'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

test('parse: ranges, steps, names, macros, sunday 7', () => {
  const p = c.parse('*/15 9-17 1,15 jan-mar mon-fri');
  assert.deepEqual(p.fields.minute.values, [0, 15, 30, 45]);
  assert.deepEqual(p.fields.hour.values, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(p.fields.dom.values, [1, 15]);
  assert.deepEqual(p.fields.month.values, [1, 2, 3]);
  assert.deepEqual(p.fields.dow.values, [1, 2, 3, 4, 5]);
  assert.deepEqual(c.parse('0 0 * * 7').fields.dow.values, [0]);
  assert.deepEqual(c.parse('5/20 * * * *').fields.minute.values, [5, 25, 45]);
  assert.equal(c.parse('@daily').raw, '0 0 * * *');
  assert.equal(c.parse('  0   0 * *   *').raw, '0 0 * * *');
});

test('parse: plain-language errors', () => {
  assert.throws(() => c.parse(''), /Type a cron expression/);
  assert.throws(() => c.parse('* * * *'), /five fields .* but this has 4/);
  assert.throws(() => c.parse('0 * * * * *'), /six fields/);
  assert.throws(() => c.parse('60 * * * *'), /minute field must be between 0 and 59/);
  assert.throws(() => c.parse('* 24 * * *'), /hour field must be between 0 and 23/);
  assert.throws(() => c.parse('* * 0 * *'), /day-of-month field must be between 1 and 31/);
  assert.throws(() => c.parse('* * * 13 *'), /month field must be between 1 and 12/);
  assert.throws(() => c.parse('* * * * 8'), /day-of-week field must be between 0 and 7/);
  assert.throws(() => c.parse('5-1 * * * *'), /runs backwards/);
  assert.throws(() => c.parse('*/0 * * * *'), /step .* above zero/);
  assert.throws(() => c.parse('a * * * *'), /"a" is not valid in the minute field/);
  assert.throws(() => c.parse('* * L * *'), /Quartz extensions/);
  assert.throws(() => c.parse('* * * * 5#2'), /Quartz extensions/);
  assert.throws(() => c.parse('@sometimes'), /not a known shortcut/);
  assert.throws(() => c.parse('1,,2 * * * *'), /empty item/);
});

test('explain: common schedules', () => {
  const e = (x) => c.explain(x);
  assert.equal(e('* * * * *'), 'Every minute');
  assert.equal(e('*/5 * * * *'), 'Every 5 minutes');
  assert.equal(e('0 * * * *'), 'At minute 0 past every hour');
  assert.equal(e('30 2 * * *'), 'At 02:30');
  assert.equal(e('0 9 * * 1-5'), 'At 09:00, on weekdays (Monday to Friday)');
  assert.equal(e('30 8 * * 1'), 'At 08:30, on Monday');
  assert.equal(e('0 0 1 * *'), 'At 00:00, on the 1st of the month');
  assert.equal(e('0 8,20 * * *'), 'At 08:00 and 20:00');
  assert.equal(e('0 6 1 1,4,7,10 *'), 'At 06:00, on the 1st of the month, in January, April, July and October');
  assert.equal(e('*/15 9-17 * * 1-5'), 'Every 15 minutes between 09:00 and 17:59, on weekdays (Monday to Friday)');
  assert.equal(e('0 0 * * 0,6'), 'At 00:00, on weekends (Saturday and Sunday)');
  assert.equal(e('0 0 * * 1,3,5'), 'At 00:00, on Monday, Wednesday and Friday');
  assert.equal(e('0 0 2-4 * *'), 'At 00:00, on the 2nd to the 4th of the month');
  assert.equal(e('0 0 1 jun-aug *'), 'At 00:00, on the 1st of the month, in June to August');
  assert.equal(e('0 0 13,22,23 * *'), 'At 00:00, on the 13th, 22nd and 23rd of the month');
  assert.equal(e('0 0 1 * 1'), 'At 00:00, on Monday or on the 1st of the month (cron runs when either matches)');
  assert.equal(e('5,35 * * * *'), 'At minutes 5 and 35');
  assert.equal(e('0 22 * * *'), 'At 22:00');
  assert.equal(e('@weekly'), 'At 00:00, on Sunday');
});

test('warnings', () => {
  assert.ok(c.warnings('0 0 1 * 1')[0].includes('either'));
  assert.ok(c.warnings('* * * * *').some((x) => /every minute/.test(x)));
  assert.ok(c.warnings('0 0 31 * *').some((x) => /does not exist in every month/.test(x)));
  assert.deepEqual(c.warnings('0 9 * * 1-5'), []);
});

test('next: daily, weekdays, boundaries and exclusive start', () => {
  assert.deepEqual(c.next('30 2 * * *', '2026-10-23T09:00', 3), ['2026-10-24T02:30', '2026-10-25T02:30', '2026-10-26T02:30']);
  assert.deepEqual(c.next('30 2 * * *', '2026-10-23T01:00', 1), ['2026-10-23T02:30']);
  assert.deepEqual(c.next('30 2 * * *', '2026-10-23T02:30', 1), ['2026-10-24T02:30']);
  assert.deepEqual(c.next('0 9 * * 1-5', '2026-10-23T10:00', 3), ['2026-10-26T09:00', '2026-10-27T09:00', '2026-10-28T09:00']);
  assert.deepEqual(c.next('*/20 * * * *', '2026-10-23T23:41', 3), ['2026-10-24T00:00', '2026-10-24T00:20', '2026-10-24T00:40']);
  assert.deepEqual(c.next('* * * * *', '2026-10-23T23:59', 2), ['2026-10-24T00:00', '2026-10-24T00:01']);
});

test('next: month and day rules', () => {
  assert.deepEqual(c.next('0 0 31 * *', '2026-10-23T00:00', 3), ['2026-10-31T00:00', '2026-12-31T00:00', '2027-01-31T00:00']);
  assert.deepEqual(c.next('0 0 29 2 *', '2026-10-23T00:00', 2), ['2028-02-29T00:00', '2032-02-29T00:00']);
  assert.deepEqual(c.next('0 0 30 2 *', '2026-10-23T00:00', 2), []);
  assert.deepEqual(c.next('0 6 1 1,4,7,10 *', '2026-10-23T00:00', 2), ['2027-01-01T06:00', '2027-04-01T06:00']);
  // day-of-month OR day-of-week
  assert.deepEqual(c.next('0 0 1 * 1', '2026-10-23T00:00', 4), [
    '2026-10-26T00:00',
    '2026-11-01T00:00',
    '2026-11-02T00:00',
    '2026-11-09T00:00',
  ]);
  assert.throws(() => c.next('* * * * *', 'tomorrow', 1), /must look like/);
  assert.equal(c.next('* * * * *', '2026-10-23T00:00', 500).length, 50);
});

test('shift between time zones', () => {
  assert.equal(c.shift('2026-10-24T02:30', -330), '2026-10-23T21:00');
  assert.equal(c.shift('2026-10-23T21:00', 330), '2026-10-24T02:30');
  assert.throws(() => c.shift('x', 0), /must look like/);
});

test('every preset explains and runs', () => {
  c.PRESETS.forEach((p) => {
    assert.ok(c.explain(p[1]).length > 3, p[0]);
    assert.ok(c.next(p[1], '2026-10-23T09:00', 2).length === 2, p[0]);
  });
  assert.equal(c.PRESETS.length, 10);
});
