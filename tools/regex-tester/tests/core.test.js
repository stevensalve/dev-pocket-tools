'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../js/core.js');

test('compile: errors in plain words', () => {
  assert.ok(r.compile('a+', 'gi') instanceof RegExp);
  assert.throws(() => r.compile('', ''), /Type a pattern first/);
  assert.throws(() => r.compile('(', ''), /Unterminated group/);
  assert.throws(() => r.compile('a', 'gg'), /repeated/);
  assert.throws(() => r.compile('a', 'z'), /"z" is not a regex flag/);
});

test('run: global matches with positions and groups', () => {
  const s = r.sample();
  const res = r.run(s.pattern, s.flags, s.text);
  assert.deepEqual(
    res.matches.map((m) => m.text),
    ['asha.k@example.com', 'ravi@mail.example.org'],
  );
  assert.deepEqual([res.matches[0].index, res.matches[0].line, res.matches[0].col], [8, 1, 9]);
  assert.deepEqual(
    res.matches[1].groups.map((g) => [g.name, g.text]),
    [
      ['user', 'ravi'],
      ['host', 'mail.example.org'],
    ],
  );
  assert.equal(res.truncated, false);
  assert.equal(res.matches[0].groups[0].index, 8);
  assert.equal(res.matches[0].groups[1].index, 15);
  assert.equal(res.canBeEmpty, false);
});

test('run: without g only the first match; zero-length matches advance', () => {
  assert.equal(r.run('a', '', 'aaa').matches.length, 1);
  assert.equal(r.run('a*', 'g', 'baab').matches.length, 4);
  assert.equal(r.run('a*', 'g', 'baab').canBeEmpty, true);
  const m = r.run('(x)?y', 'g', 'y xy').matches;
  assert.deepEqual(
    m.map((x) => x.groups[0].text),
    [null, 'x'],
  );
  assert.equal(r.run('^\\w+', 'gm', 'one\ntwo').matches[1].line, 2);
});

test('run: limits', () => {
  const t = r.run('a', 'g', 'a'.repeat(1500));
  assert.equal(t.matches.length, 1000);
  assert.equal(t.truncated, true);
  assert.throws(() => r.run('a', 'g', 'a'.repeat(200001)), /over 200,000 characters/);
});

test('warnings: nested quantifiers', () => {
  assert.equal(r.warnings('(a+)+$').length, 1);
  assert.equal(r.warnings('(a|a)*').length, 1);
  assert.equal(r.warnings('^\\d{3}-\\d{4}$').length, 0);
  assert.equal(r.warnings('(?:ab)+').length, 0);
  assert.ok(r.run('(a+)+$', '', 'aaaa').warnings.length === 1);
});

test('segments for highlighting', () => {
  const t = 'ab cd ab';
  const m = r.run('ab', 'g', t).matches;
  assert.deepEqual(r.segments(t, m), [
    { text: 'ab', match: 0 },
    { text: ' cd ', match: null },
    { text: 'ab', match: 1 },
  ]);
  assert.deepEqual(r.segments('xyz', r.run('q*', 'g', 'xyz').matches), [{ text: 'xyz', match: null }]);
});

test('replace', () => {
  assert.equal(r.replace('(\\w+)@(\\w+)', 'g', 'a@b c@d', '$2 at $1'), 'b at a d at c');
  assert.equal(r.replace('(?<n>\\d+)', 'g', 'a1b22', '<$<n>>'), 'a<1>b<22>');
  assert.equal(r.replace('x', 'g', 'axbx', ''), 'ab');
  assert.throws(() => r.replace('(', '', 'a', ''), /Unterminated/);
});

test('explain: tokens in plain English', () => {
  const e = r.explain('^(?<id>\\d{2,4})-[a-z_]+?(?:x|y)$');
  assert.deepEqual(
    e.map((x) => x.token),
    ['^', '(?<id>', '\\d', '{2,4}', ')', '-', '[a-z_]', '+?', '(?:', 'x', '|', 'y', ')', '$'],
  );
  assert.equal(e[1].meaning, 'start of a capture group named id');
  assert.equal(e[3].meaning, 'between 2 and 4 times');
  assert.equal(e[2].depth, 1);
  assert.equal(e[6].meaning, 'any one of a to z, _');
  assert.equal(e[7].meaning, 'one or more times, as few as possible');
  assert.equal(r.explain('a{3}')[1].meaning, 'exactly 3 times');
  assert.equal(r.explain('a{3,}')[1].meaning, '3 or more times');
  assert.equal(r.explain('(?<!x)\\p{L}\\1')[3].meaning, 'a Unicode property: L');
  assert.equal(r.explain('[^0-9]')[0].meaning, 'any one character except 0 to 9');
  assert.equal(r.explain('a|b')[1].meaning, 'or');
  assert.deepEqual(r.explain(''), []);
});

test('snippets: every example behaves', () => {
  r.SNIPPETS.forEach((s) => {
    const re = r.compile(s.pattern, s.flags);
    s.yes.forEach((x) => assert.ok(re.test(x), s.name + ' should match ' + x));
    s.no.forEach((x) => assert.ok(!re.test(x), s.name + ' should not match ' + x));
  });
  assert.equal(r.SNIPPETS.length, 12);
});
