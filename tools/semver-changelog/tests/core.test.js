'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/core.js');

test('parse and reject versions', () => {
  const v = S.parse('v1.2.3-beta.1+build.5');
  assert.deepStrictEqual([v.major, v.minor, v.patch, v.pre, v.build], [1, 2, 3, ['beta', '1'], 'build.5']);
  assert.strictEqual(v.text, '1.2.3-beta.1+build.5');
  ['1.2', '01.2.3', '1.2.3.4', '', 'abc', '1.2.3-', '1.2.3-01'].forEach((x) => assert.strictEqual(S.valid(x), false, x));
  assert.throws(() => S.parse('1.2'), /not a valid version/);
});

test('compare follows the semver.org precedence example', () => {
  const order = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
  for (let i = 0; i < order.length - 1; i++) assert.strictEqual(S.compare(order[i], order[i + 1]), -1, order[i]);
  assert.strictEqual(S.compare('1.0.0+a', '1.0.0+b'), 0);
  assert.strictEqual(S.compare('2.0.0', '1.9.9'), 1);
  assert.strictEqual(S.compare('1.10.0', '1.9.0'), 1);
});

test('sort and diff', () => {
  const r = S.sort(['1.10.0', '1.2.0', 'oops', '1.2.0-rc.1'], false);
  assert.deepStrictEqual(r.sorted, ['1.2.0-rc.1', '1.2.0', '1.10.0']);
  assert.deepStrictEqual(r.invalid, ['oops']);
  assert.strictEqual(S.sort(['1.0.0', '2.0.0'], true).sorted[0], '2.0.0');
  assert.strictEqual(S.diff('1.2.3', '2.0.0'), 'major');
  assert.strictEqual(S.diff('1.3.0', '1.2.9'), 'minor');
  assert.strictEqual(S.diff('1.2.3', '1.2.4'), 'patch');
  assert.strictEqual(S.diff('1.2.3', '1.2.3-rc.1'), 'prerelease');
  assert.strictEqual(S.diff('1.2.3', '1.2.3'), 'none');
});

test('bump matches npm semver behaviour', () => {
  assert.strictEqual(S.bump('1.2.3', 'major'), '2.0.0');
  assert.strictEqual(S.bump('1.2.3', 'minor'), '1.3.0');
  assert.strictEqual(S.bump('1.2.3', 'patch'), '1.2.4');
  assert.strictEqual(S.bump('1.2.3-rc.1', 'patch'), '1.2.3');
  assert.strictEqual(S.bump('1.3.0-rc.1', 'minor'), '1.3.0');
  assert.strictEqual(S.bump('2.0.0-rc.1', 'major'), '2.0.0');
  assert.strictEqual(S.bump('1.2.3', 'premajor', 'beta'), '2.0.0-beta.0');
  assert.strictEqual(S.bump('1.2.3', 'preminor'), '1.3.0-rc.0');
  assert.strictEqual(S.bump('1.2.3', 'prepatch'), '1.2.4-rc.0');
  assert.strictEqual(S.bump('1.2.3', 'prerelease', 'rc'), '1.2.4-rc.0');
  assert.strictEqual(S.bump('1.2.4-rc.0', 'prerelease', 'rc'), '1.2.4-rc.1');
  assert.strictEqual(S.bump('1.2.4-rc.1', 'prerelease', 'beta'), '1.2.4-beta.0');
  assert.strictEqual(S.bump('1.2.3+meta', 'patch'), '1.2.4');
  assert.throws(() => S.bump('1.0.0', 'huge'), /Unknown bump/);
  assert.throws(() => S.bump('1.0.0', 'prepatch', 'a b'), /pre-release label/);
});

test('ranges: caret, tilde, x, comparators, hyphen, or', () => {
  const ok = (v, r) => assert.strictEqual(S.satisfies(v, r), true, v + ' in ' + r);
  const no = (v, r) => assert.strictEqual(S.satisfies(v, r), false, v + ' not in ' + r);
  ok('1.9.9', '^1.2.3');
  no('2.0.0', '^1.2.3');
  no('1.2.2', '^1.2.3');
  ok('0.2.9', '^0.2.3');
  no('0.3.0', '^0.2.3');
  ok('0.0.3', '^0.0.3');
  no('0.0.4', '^0.0.3');
  ok('1.9.0', '^1.x');
  ok('0.9.0', '^0.x');
  no('1.0.0', '^0.x');
  ok('1.2.9', '~1.2.3');
  no('1.3.0', '~1.2.3');
  ok('1.9.0', '~1');
  no('1.1.0', '~1.2');
  ok('1.2.7', '1.2.x');
  no('1.3.0', '1.2.x');
  ok('9.9.9', '*');
  ok('3.0.0', '');
  ok('2.5.0', '>=2 <3');
  no('3.0.0', '>=2 <3');
  ok('2.0.0', '>= 2.0.0');
  no('2.0.0', '>2.0.0');
  ok('1.5.0', '1.2.3 - 2.3.4');
  ok('2.3.4', '1.2.3 - 2.3.4');
  no('2.3.5', '1.2.3 - 2.3.4');
  ok('2.3.9', '1.2.3 - 2.3');
  ok('1.0.0', '^2 || 1.0.0');
  no('1.1.0', '^2 || 1.0.0');
  ok('1.2.3', '=1.2.3');
  no('1.2.4', '1.2.3');
  ok('3.1.0', '>=3.1');
  no('2.9.9', '>2');
  ok('3.0.0', '>2');
  assert.throws(() => S.parseRange('^1.2.q'), /not a valid version range/);
});

test('prerelease only matches when the range names it', () => {
  assert.strictEqual(S.satisfies('1.2.4-rc.1', '^1.2.3'), false);
  assert.strictEqual(S.satisfies('1.2.4-rc.1', '>=1.2.4-rc.0'), true);
  assert.strictEqual(S.satisfies('1.3.0-rc.1', '>=1.2.4-rc.0'), false);
});

test('filter and explain range', () => {
  const r = S.filter(['1.0.0', '1.4.0', '2.0.0', 'bad', ''], '^1.0.0');
  assert.strictEqual(r.rows.length, 4);
  assert.strictEqual(r.highest, '1.4.0');
  assert.strictEqual(r.rows[3].invalid, true);
  assert.strictEqual(S.explainRange('^1.2.3'), 'at least 1.2.3 and below 2.0.0');
  assert.strictEqual(S.explainRange('1.0.0 || 2.0.0'), 'exactly 1.0.0, or exactly 2.0.0');
});

test('parse conventional commits', () => {
  const c = S.parseCommit('a1b2c3d feat(api)!: add search (#12) #13');
  assert.deepStrictEqual([c.type, c.scope, c.breaking, c.hash], ['feat', 'api', true, 'a1b2c3d']);
  assert.deepStrictEqual(c.issues, ['12', '13']);
  assert.strictEqual(S.parseCommit('- fix: typo').type, 'fix');
  assert.strictEqual(S.parseCommit('Merge branch x'), null);
  assert.strictEqual(S.parseCommit('wip: stuff'), null);
  assert.strictEqual(S.parseCommit('feat:nospace'), null);
  assert.strictEqual(S.parseCommit('fix: drop api BREAKING CHANGE removed v1').breaking, true);
});

test('release suggests the next version', () => {
  const r = S.release(S.sample(), { current: '1.4.2' });
  assert.strictEqual(r.level, 'major');
  assert.strictEqual(r.next, '2.0.0');
  assert.strictEqual(r.counts.total, 8);
  assert.deepStrictEqual(r.skipped, ['Merge branch main into release']);
  assert.strictEqual(S.release('feat: a\nfix: b', { current: '1.4.2' }).next, '1.5.0');
  assert.strictEqual(S.release('fix: b\ndocs: c', { current: '1.4.2' }).next, '1.4.3');
  assert.strictEqual(S.release('docs: c', { current: '1.4.2' }).level, 'none');
  assert.strictEqual(S.release('docs: c', { current: '1.4.2' }).next, '1.4.2');
  assert.strictEqual(S.release('feat!: x', { current: '0.3.1' }).next, '0.4.0');
  assert.throws(() => S.release('hello\nworld', {}), /conventional commits/);
  assert.throws(() => S.release('  ', {}), /one commit message per line/);
});

test('markdown release notes', () => {
  const r = S.release(S.sample(), { current: '1.4.2' });
  const md = S.markdown(r, { date: '2026-10-23' });
  assert.ok(md.startsWith('## 2.0.0 (2026-10-23)'));
  assert.ok(md.includes('### BREAKING CHANGES'));
  assert.ok(md.includes('### Features'));
  assert.ok(md.includes('- **api:** add order search endpoint (#412)'));
  assert.ok(!md.includes('### Documentation'));
  assert.ok(S.markdown(S.release(S.sample(), { current: '1.4.2', all: true })).includes('### Documentation'));
  assert.ok(S.markdown(S.release('docs: x', {})).includes('No user-facing changes.'));
});
