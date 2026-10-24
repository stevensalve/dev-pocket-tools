'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../js/core.js');

const NOW = Date.UTC(2026, 9, 23, 6, 30, 0); // 2026-10-23 12:00 IST

test('offsetAt and labels, including daylight saving', () => {
  assert.equal(t.offsetAt(NOW, 'Asia/Kolkata'), 330);
  assert.equal(t.offsetAt(NOW, 'UTC'), 0);
  assert.equal(t.offsetAt(Date.UTC(2026, 6, 1), 'America/New_York'), -240);
  assert.equal(t.offsetAt(Date.UTC(2026, 0, 1), 'America/New_York'), -300);
  assert.equal(t.offsetAt(Date.UTC(2026, 0, 1), 'Australia/Sydney'), 660);
  assert.equal(t.offsetLabel(330), 'UTC+05:30');
  assert.equal(t.offsetLabel(-300), 'UTC-05:00');
  assert.throws(() => t.offsetAt(NOW, 'Mars/Base'), /not a time zone/);
});

test('parse Unix timestamps by digit count', () => {
  assert.deepEqual(t.parse('1761201000', 'UTC', NOW), { ms: 1761201000000, kind: 'Unix seconds' });
  assert.deepEqual(t.parse('1761201000123', 'UTC', NOW), { ms: 1761201000123, kind: 'Unix milliseconds' });
  assert.deepEqual(t.parse('1761201000123456', 'UTC', NOW), { ms: 1761201000123, kind: 'Unix microseconds' });
  assert.deepEqual(t.parse('1761201000123456789', 'UTC', NOW), { ms: 1761201000123, kind: 'Unix nanoseconds' });
  assert.equal(t.parse('1761201000.5', 'UTC', NOW).ms, 1761201000500);
  assert.equal(t.parse('0', 'UTC', NOW).ms, 0);
  assert.equal(t.parse('-86400', 'UTC', NOW).ms, -86400000);
  assert.equal(t.parse('now', 'UTC', NOW).ms, NOW);
  assert.throws(() => t.parse('123456789012345678901', 'UTC', NOW), /too many digits/);
});

test('parse ISO 8601: zone, offset, none', () => {
  assert.equal(t.parse('2026-10-23T12:00:00Z', 'Asia/Kolkata', NOW).ms, Date.UTC(2026, 9, 23, 12));
  assert.equal(t.parse('2026-10-23T12:00:00+05:30', 'UTC', NOW).ms, Date.UTC(2026, 9, 23, 6, 30));
  assert.equal(t.parse('2026-10-23 12:00', 'Asia/Kolkata', NOW).ms, NOW);
  assert.equal(t.parse('2026-10-23', 'UTC', NOW).ms, Date.UTC(2026, 9, 23));
  assert.equal(t.parse('2026-10-23T12:00:00.250Z', 'UTC', NOW).ms, Date.UTC(2026, 9, 23, 12) + 250);
  assert.equal(t.parse('2026-10-23T12:00:00-0800', 'UTC', NOW).ms, Date.UTC(2026, 9, 23, 20));
  assert.throws(() => t.parse('2026-02-30', 'UTC', NOW), /not a real date/);
  assert.throws(() => t.parse('2026-10-23 25:00', 'UTC', NOW), /not a real date/);
});

test('parse Indian and written dates', () => {
  assert.equal(t.parse('23/10/2026 12:00', 'Asia/Kolkata', NOW).ms, NOW);
  assert.equal(t.parse('23-10-2026 12:00:30', 'Asia/Kolkata', NOW).ms, NOW + 30000);
  assert.equal(t.parse('23/10/2026 12:00 pm', 'Asia/Kolkata', NOW).ms, NOW);
  assert.equal(t.parse('23/10/2026 12:00 am', 'Asia/Kolkata', NOW).ms, NOW - 12 * 3600000);
  assert.equal(t.parse('23/10/2026', 'Asia/Kolkata', NOW).ms, Date.UTC(2026, 9, 22, 18, 30));
  assert.equal(t.parse('23 Oct 2026 12:00', 'Asia/Kolkata', NOW).ms, NOW);
  assert.equal(t.parse('3 October 2026, 5:30 pm', 'Asia/Kolkata', NOW).ms, Date.UTC(2026, 9, 3, 12));
  assert.throws(() => t.parse('13/13/2026', 'UTC', NOW), /day\/month\/year/);
  assert.throws(() => t.parse('23 Foo 2026', 'UTC', NOW), /not a month name/);
  assert.throws(() => t.parse('yesterday-ish', 'UTC', NOW), /not recognised/);
  assert.throws(() => t.parse('', 'UTC', NOW), /Type a time/);
  assert.throws(() => t.parse('-99999999999', 'UTC', NOW), /outside the years/);
});

test('wallToMs around daylight saving', () => {
  // New York: 2026-03-08 02:30 does not exist; 2026-11-01 01:30 happens twice.
  assert.equal(t.show(t.wallToMs(2026, 3, 8, 12, 0, 0, 'America/New_York'), 'America/New_York').time, '12:00:00');
  assert.equal(t.offsetAt(t.wallToMs(2026, 11, 1, 1, 30, 0, 'America/New_York'), 'America/New_York'), -240);
  assert.equal(t.show(t.wallToMs(2026, 3, 8, 2, 30, 0, 'America/New_York'), 'America/New_York').time, '03:30:00');
});

test('relative wording', () => {
  assert.equal(t.relative(NOW, NOW), 'just now');
  assert.equal(t.relative(NOW + 3 * 3600000, NOW), 'in 3 hours');
  assert.equal(t.relative(NOW - 3600000, NOW), '1 hour ago');
  assert.equal(t.relative(NOW + 90 * 86400000, NOW), 'in 3 months');
  assert.equal(t.relative(NOW - 400 * 86400000, NOW), '13 months ago');
  assert.equal(t.relative(NOW - 30 * 1000, NOW), '30 seconds ago');
  assert.equal(t.relative(NOW + 5 * 365 * 86400000, NOW), 'in 5 years');
});

test('show and describe', () => {
  const s = t.show(NOW, 'Asia/Kolkata');
  assert.deepEqual(
    [s.date, s.time, s.iso, s.weekday, s.offsetLabel],
    ['23/10/2026', '12:00:00', '2026-10-23T12:00:00+05:30', 'Friday', 'UTC+05:30'],
  );
  assert.equal(t.show(NOW, 'UTC').iso, '2026-10-23T06:30:00Z');
  const d = t.describe(NOW, NOW);
  assert.equal(d.seconds, 1792737000);
  assert.equal(d.microseconds, '1792737000000000');
  assert.equal(d.isoUtc, '2026-10-23T06:30:00.000Z');
  assert.equal(d.zones.length, t.ZONES.length);
  assert.equal(d.zones.find((z) => z.zone === 'America/New_York').time, '02:30:00');
  assert.equal(d.zones.find((z) => z.zone === 'Australia/Sydney').offset, 660);
});

test('between', () => {
  assert.deepEqual(t.between(NOW, NOW + 90061000), { ms: 90061000, days: 1, hours: 1, minutes: 1, seconds: 1, text: '1 d 1 h 1 min 1 s' });
  assert.equal(t.between(NOW, NOW).text, '0 s');
  assert.equal(t.between(NOW + 3600000, NOW).ms, -3600000);
  assert.equal(t.between(NOW, NOW + 3600000).text, '1 h');
});
