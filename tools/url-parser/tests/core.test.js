'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../js/core.js');

test('parse the sample URL into parts', () => {
  const p = u.parse(u.sample());
  assert.equal(p.protocol, 'https');
  assert.equal(p.username, 'user');
  assert.equal(p.hostname, 'shop.example.com');
  assert.equal(p.port, '8443');
  assert.equal(p.origin, 'https://shop.example.com:8443');
  assert.equal(p.pathname, '/en-in/products/running%20shoes');
  assert.deepEqual(p.segments, ['en-in', 'products', 'running shoes']);
  assert.equal(p.hash, '#reviews');
  assert.deepEqual(
    p.params.map((x) => x.key + '=' + x.value),
    ['utm_source=newsletter', 'utm_medium=email', 'utm_campaign=diwali-sale', 'size=9', 'size=10', 'token=abc123', 'q=café'],
  );
  assert.ok(p.warnings.some((w) => /user name or password/.test(w)));
  assert.ok(p.warnings.some((w) => /look like secrets: token/.test(w)));
  assert.ok(p.notes.some((n) => /Repeated parameters: size/.test(n)));
});

test('parse: defaults, ports, ip, passwords, problems', () => {
  const a = u.parse('example.com/a?x=1');
  assert.equal(a.protocol, 'https');
  assert.ok(a.notes[0].includes('https:// was assumed'));
  assert.equal(a.effectivePort, '443');
  assert.equal(u.parse('http://example.com').effectivePort, '80');
  assert.ok(u.parse('http://example.com').warnings.some((w) => /http, not https/.test(w)));
  assert.equal(u.parse('localhost:3000/x').hostname, 'localhost');
  assert.equal(u.parse('localhost:3000/x').port, '3000');
  assert.equal(u.parse('http://192.168.1.10:8080/').isIp, true);
  assert.equal(u.parse('https://example.com').isIp, false);
  const pw = u.parse('https://a:secretpw@example.com/');
  assert.equal(pw.password, '(hidden: 8 characters)');
  assert.equal(pw.href, 'https://a:***@example.com/');
  assert.ok(!JSON.stringify(pw).includes('secretpw'));
  assert.ok(u.parse('https://e.com/?q=a%2520b').warnings.some((w) => /double-encoded/.test(w)));
  assert.throws(() => u.parse(''), /Paste a URL/);
  assert.throws(() => u.parse('https://exa mple.com'), /cannot contain spaces/);
  assert.throws(() => u.parse('https://'), /not a valid URL/);
  assert.equal(u.parse('mailto:a@b.com').origin, '');
});

test('rebuild with edited parameters and encoding', () => {
  assert.equal(
    u.rebuild('https://e.com/p?a=1&b=2', [
      { key: 'a', value: 'x y' },
      { key: 'c', value: 'é&=' },
      { key: '', value: 'skip' },
    ]),
    'https://e.com/p?a=x+y&c=%C3%A9%26%3D',
  );
  assert.equal(u.rebuild('https://e.com/p?a=1#top', []), 'https://e.com/p#top');
  assert.equal(u.rebuild('https://e.com/p?a=1#top', [{ key: 'a', value: '1' }], '#end'), 'https://e.com/p?a=1#end');
});

test('sort, strip tracking, object conversion', () => {
  const p = u.parse(u.sample()).params;
  assert.deepEqual(
    u
      .sortParams(p)
      .map((x) => x.key)
      .slice(0, 3),
    ['q', 'size', 'size'],
  );
  const s = u.stripTracking(p);
  assert.deepEqual(s.removed, ['utm_source', 'utm_medium', 'utm_campaign']);
  assert.equal(s.params.length, 4);
  assert.deepEqual(u.toObject(p).size, ['9', '10']);
  assert.equal(u.toObject(p).q, 'café');
  assert.deepEqual(u.fromObject({ a: '1', b: ['x', 'y'], c: null, d: 5, e: { z: 1 } }), [
    { key: 'a', value: '1' },
    { key: 'b', value: 'x' },
    { key: 'b', value: 'y' },
    { key: 'c', value: '' },
    { key: 'd', value: '5' },
    { key: 'e', value: '{"z":1}' },
  ]);
  assert.throws(() => u.fromObject([1]), /JSON object/);
});

test('resolve relative references', () => {
  assert.equal(u.resolve('https://e.com/a/b/c?x=1', '../d'), 'https://e.com/a/d');
  assert.equal(u.resolve('https://e.com/a/b', '/root'), 'https://e.com/root');
  assert.equal(u.resolve('https://e.com/a/b', '?q=1'), 'https://e.com/a/b?q=1');
  assert.equal(u.resolve('https://e.com/a', '//other.com/x'), 'https://other.com/x');
});
