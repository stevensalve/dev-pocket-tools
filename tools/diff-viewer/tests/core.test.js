'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../js/core.js');

const types = (r) => r.rows.map((x) => (x.type === 'eq' ? '=' : x.type === 'add' ? '+' : '-')).join('');

test('lines: CRLF, trailing newline, empty', () => {
  assert.deepEqual(d.lines('a\r\nb\n'), ['a', 'b']);
  assert.deepEqual(d.lines('a\n\n'), ['a', '']);
  assert.deepEqual(d.lines(''), []);
  assert.deepEqual(d.lines('x'), ['x']);
});

test('diff: identical, empty sides, all different', () => {
  assert.equal(d.diff('a\nb', 'a\nb').identical, true);
  assert.equal(d.diff('', '').similarity, 1);
  assert.equal(types(d.diff('', 'a\nb')), '++');
  assert.equal(types(d.diff('a\nb', '')), '--');
  assert.equal(types(d.diff('a\nb', 'c\nd')), '--++');
});

test('diff: insert, delete, replace with correct line numbers', () => {
  const r = d.diff('a\nb\nc\nd', 'a\nB\nc\nd\ne');
  assert.equal(types(r), '=-+==+');
  assert.deepEqual(
    r.rows.map((x) => [x.a, x.b]),
    [
      [1, 1],
      [2, null],
      [null, 2],
      [3, 3],
      [4, 4],
      [null, 5],
    ],
  );
  assert.deepEqual([r.added, r.removed, r.same], [2, 1, 3]);
  assert.equal(r.similarity, (2 * 3) / 9);
});

test('diff: finds the shortest script, not just a valid one', () => {
  const r = d.diff('1\n2\n3\n4\n5\n6\n7', '2\n3\n4\n5\n6\n7\n8');
  assert.deepEqual([r.removed, r.added], [1, 1]);
  const s = d.diff('x\na\nb\nc\ny', 'x\nc\nb\na\ny');
  assert.deepEqual([s.removed, s.added], [2, 2]);
});

test('diff: options and notes', () => {
  assert.equal(d.diff('Hello  World', 'hello world', { ignoreWhitespace: true, ignoreCase: true }).identical, true);
  assert.equal(d.diff('Hello', 'hello').identical, false);
  assert.equal(d.diff('a  b', 'a b').identical, false);
  assert.equal(d.diff('a  b', 'a b', { ignoreWhitespace: true }).identical, true);
  assert.ok(d.diff('a\r\nb', 'a\nb').notes[0].includes('CRLF'));
  assert.equal(d.diff('a\r\nb', 'a\nb').identical, true);
  assert.throws(() => d.diff('x\n'.repeat(20001), ''), /up to 20,000 lines/);
});

test('diff: very different large texts degrade gracefully', () => {
  const a = Array.from({ length: 4000 }, (_, i) => 'a' + i).join('\n');
  const b = Array.from({ length: 4000 }, (_, i) => 'b' + i).join('\n');
  const r = d.diff(a, b);
  assert.equal(r.notes.length, 1);
  assert.deepEqual([r.removed, r.added], [4000, 4000]);
});

test('sideBySide pairs changes', () => {
  const rows = d.sideBySide(d.diff('a\nb\nc\nd', 'a\nB\nC\nd\ne').rows);
  assert.deepEqual(
    rows.map((r) => r.type),
    ['eq', 'change', 'change', 'eq', 'add'],
  );
  assert.deepEqual([rows[1].left.text, rows[1].right.text, rows[1].left.no, rows[1].right.no], ['b', 'B', 2, 2]);
  assert.equal(rows[4].left, null);
  assert.equal(
    d
      .sideBySide(d.diff('a\nb\nc', 'a').rows)
      .map((r) => r.type)
      .join(','),
    'eq,del,del',
  );
});

test('words highlights only what changed', () => {
  const w = d.words('timeout: 30 seconds', 'timeout: 45 seconds');
  assert.deepEqual(
    w.left.map((x) => [x.text, x.changed]),
    [
      ['timeout: ', false],
      ['30', true],
      [' seconds', false],
    ],
  );
  assert.deepEqual(
    w.right.map((x) => [x.text, x.changed]),
    [
      ['timeout: ', false],
      ['45', true],
      [' seconds', false],
    ],
  );
  assert.deepEqual(d.words('', 'x').right, [{ text: 'x', changed: true }]);
});

test('unified diff matches the standard format', () => {
  const r = d.diff('line1\nline2\nline3', 'line1\nLINE2\nline3');
  assert.equal(d.unified(r.rows, 'old.txt', 'new.txt'), '--- old.txt\n+++ new.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+LINE2\n line3\n');
  assert.equal(d.unified(d.diff('a', 'a').rows), '');
  assert.equal(d.unified(d.diff('', 'x\ny').rows), '--- a\n+++ b\n@@ -0,0 +1,2 @@\n+x\n+y\n');
  const far = d.diff(
    Array.from({ length: 20 }, (_, i) => 'l' + i).join('\n'),
    Array.from({ length: 20 }, (_, i) => (i === 2 || i === 17 ? 'X' + i : 'l' + i)).join('\n'),
  );
  const u = d.unified(far.rows, 'a', 'b', 1);
  assert.equal((u.match(/^@@/gm) || []).length, 2);
  assert.match(u, /@@ -2,3 \+2,3 @@\n l1\n-l2\n\+X2\n l3\n@@ -17,3 \+17,3 @@\n l16\n-l17\n\+X17\n l18\n/);
});

test('sample shows changes', () => {
  const s = d.sample();
  const r = d.diff(s.a, s.b);
  assert.deepEqual([r.removed, r.added], [2, 4]);
});
