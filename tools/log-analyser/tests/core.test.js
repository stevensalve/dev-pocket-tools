'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');

test('parses text, json and logfmt lines', () => {
  const a = C.parseLine('2026-10-23 09:01:40,771 ERROR [http-3] Payment failed');
  assert.strictEqual(a.level, 'ERROR');
  assert.strictEqual(a.timeText, '2026-10-23 09:01:40.771');
  assert.strictEqual(a.time, Date.UTC(2026, 9, 23, 9, 1, 40, 771));
  const j = C.parseLine('{"time":"2026-10-23T09:04:10Z","level":"error","msg":"boom"}');
  assert.strictEqual(j.level, 'ERROR');
  assert.strictEqual(j.message, 'boom');
  const p = C.parseLine('{"level":50,"time":1792746250000,"msg":"x"}');
  assert.strictEqual(p.level, 'ERROR');
  const f = C.parseLine('time=2026-10-23T09:00:00Z level=warn msg="disk low"');
  assert.strictEqual(f.format, 'logfmt');
  assert.strictEqual(f.level, 'WARN');
  assert.strictEqual(f.message, 'disk low');
  assert.strictEqual(C.parseLine('   '), null);
});

test('parses access log lines with zone and latency', () => {
  const e = C.parseLine('10.0.0.5 - - [23/Oct/2026:09:00:00 +0530] "GET /api/x?a=1 HTTP/1.1" 502 120 "-" "curl" 1.25');
  assert.strictEqual(e.level, 'ERROR');
  assert.strictEqual(e.time, Date.UTC(2026, 9, 23, 3, 30, 0));
  assert.strictEqual(e.access.path, '/api/x');
  assert.strictEqual(e.access.seconds, 1.25);
});

test('attaches stack trace lines to the previous entry', () => {
  const r = C.parse(C.sample());
  assert.strictEqual(r.entries.length, 11);
  assert.strictEqual(r.entries[3].extra.length, 3);
});

test('pattern normalises ids and numbers', () => {
  assert.strictEqual(C.pattern('Payment failed for order 40213 after 30000 ms'), 'Payment failed for order <n> after <n> ms');
  assert.strictEqual(C.pattern('connect 10.0.3.14:6379 refused'), 'connect <ip> refused');
  assert.ok(C.pattern('id 123e4567-e89b-12d3-a456-426614174000').includes('<uuid>'));
});

test('analyse counts levels, groups problems, finds busiest minute', () => {
  const a = C.analyse(C.parse(C.sample()).entries);
  assert.strictEqual(a.total, 11);
  assert.strictEqual(a.levels.ERROR, 5);
  assert.strictEqual(a.levels.FATAL, 1);
  assert.strictEqual(a.levels.WARN, 2);
  assert.strictEqual(a.unit, 'minute');
  assert.strictEqual(a.topProblems[0].count, 3);
  assert.ok(a.topProblems[0].pattern.startsWith('Payment failed'));
  assert.ok(a.topProblems[0].hasTrace);
  assert.strictEqual(a.busiest.total, 3);
  assert.throws(() => C.analyse([]), /No log entries/);
});

test('filter by level, text, regex and time', () => {
  const e = C.parse(C.sample()).entries;
  assert.strictEqual(C.filter(e, { levels: ['ERROR'] }).length, 5);
  assert.strictEqual(C.filter(e, { text: 'slow query' }).length, 2);
  assert.strictEqual(C.filter(e, { text: 'order 4\\d{4}', regex: true }).length, 3);
  assert.strictEqual(C.filter(e, { from: Date.UTC(2026, 9, 23, 9, 4, 0) }).length, 3);
  assert.throws(() => C.filter(e, { text: '(', regex: true }), /valid regular expression/);
});

test('access analysis', () => {
  const t = [
    '1.1.1.1 - - [23/Oct/2026:09:00:00 +0000] "GET /a HTTP/1.1" 200 10',
    '1.1.1.1 - - [23/Oct/2026:09:00:01 +0000] "GET /a HTTP/1.1" 500 10',
    '2.2.2.2 - - [23/Oct/2026:09:00:02 +0000] "POST /b HTTP/1.1" 404 10',
  ].join('\n');
  const a = C.analyse(C.parse(t).entries);
  assert.strictEqual(a.access.requests, 3);
  assert.strictEqual(a.access.paths[0].key, 'GET /a');
  assert.strictEqual(a.access.failedPaths[0].key, 'GET /a');
  assert.strictEqual(a.access.bytes, 30);
});

test('csv has BOM and formula guard', () => {
  const csv = C.toCsv([{ timeText: '', level: 'INFO', message: '=SUM(1)', format: 'text', extra: [] }]);
  assert.strictEqual(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes("'=SUM(1)"));
});

test('toText summary and size guard', () => {
  assert.ok(C.toText(C.analyse(C.parse(C.sample()).entries)).includes('Top problems'));
  assert.throws(() => C.parse('x'.repeat(20000001)), /20 million/);
});
