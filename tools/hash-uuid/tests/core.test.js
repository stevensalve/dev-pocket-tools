'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const h = require('../js/core.js');

const env = {
  subtle: globalThis.crypto.subtle,
  getRandomValues: (b) => globalThis.crypto.getRandomValues(b),
  nowMs: Date.UTC(2026, 9, 23, 6, 30, 0),
};
const T = (s) => new TextEncoder().encode(s);

test('MD5 matches the RFC 1321 test suite', () => {
  const hex = (b) => Buffer.from(b).toString('hex');
  const cases = {
    '': 'd41d8cd98f00b204e9800998ecf8427e',
    a: '0cc175b9c0f1b6a831c399e269772661',
    abc: '900150983cd24fb0d6963f7d28e17f72',
    'message digest': 'f96b697d7cb7938d525a2f31aaf161d0',
    abcdefghijklmnopqrstuvwxyz: 'c3fcd3d76192e4007dfb496cca67e13b',
    'The quick brown fox jumps over the lazy dog': '9e107d9d372bb6826bd81d3542a419d6',
  };
  Object.keys(cases).forEach((k) => assert.equal(hex(h.md5(T(k))), cases[k], k));
  const long = 'x'.repeat(1000);
  assert.equal(hex(h.md5(T(long))), nodeCrypto.createHash('md5').update(long).digest('hex'));
  for (const n of [55, 56, 57, 63, 64, 65, 119, 120])
    assert.equal(hex(h.md5(T('a'.repeat(n)))), nodeCrypto.createHash('md5').update('a'.repeat(n)).digest('hex'), 'length ' + n);
});

test('digest: SHA family agrees with Node', async () => {
  for (const [id, node] of [
    ['SHA-1', 'sha1'],
    ['SHA-256', 'sha256'],
    ['SHA-384', 'sha384'],
    ['SHA-512', 'sha512'],
    ['MD5', 'md5'],
  ]) {
    assert.equal(await h.digest(env, T('abc'), id), nodeCrypto.createHash(node).update('abc').digest('hex'), id);
  }
  assert.equal(await h.digest(env, T('abc'), 'SHA-256'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await h.digest(env, new Uint8Array(0), 'SHA-1'), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.equal(await h.digest({}, T('abc'), 'MD5'), '900150983cd24fb0d6963f7d28e17f72');
  await assert.rejects(h.digest({}, T('abc'), 'SHA-256'), /no Web Crypto/);
  await assert.rejects(h.digest(env, T('abc'), 'SHA-3'), /Unknown algorithm/);
});

test('hashText returns every algorithm; non-ASCII is hashed as UTF-8', async () => {
  const r = await h.hashText(env, 'नमस्ते');
  assert.deepEqual(Object.keys(r), ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);
  assert.equal(r['SHA-256'], nodeCrypto.createHash('sha256').update('नमस्ते').digest('hex'));
});

test('hmac agrees with Node and the Wikipedia vector', async () => {
  const msg = 'The quick brown fox jumps over the lazy dog';
  assert.equal(await h.hmac(env, 'key', msg, 'SHA-256'), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  assert.equal(await h.hmac(env, 'key', msg, 'SHA-512'), nodeCrypto.createHmac('sha512', 'key').update(msg).digest('hex'));
  await assert.rejects(h.hmac(env, '', msg, 'SHA-256'), /Type a key/);
  await assert.rejects(h.hmac(env, 'k', msg, 'MD5'), /HMAC supports/);
});

test('cleanChecksum understands common formats', () => {
  const sha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.deepEqual(h.cleanChecksum(sha + '  file.iso'), { hex: sha, algo: 'SHA-256' });
  assert.deepEqual(h.cleanChecksum('SHA256: ' + sha.toUpperCase()), { hex: sha, algo: 'SHA-256' });
  assert.deepEqual(h.cleanChecksum('SHA256 (file.iso) = ' + sha), { hex: sha, algo: 'SHA-256' });
  assert.equal(h.cleanChecksum(sha.match(/../g).join(':')).hex, sha);
  assert.equal(h.cleanChecksum('900150983cd24fb0d6963f7d28e17f72').algo, 'MD5');
  assert.equal(h.cleanChecksum('abc').algo, null);
});

test('compare reports match, mismatch and mistakes clearly', () => {
  const sha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assert.deepEqual(h.compare(sha, sha.toUpperCase() + ' x', 'SHA-256'), { ok: true, message: 'The checksums match.' });
  assert.equal(h.compare(sha, sha.replace('ba', 'bb'), 'SHA-256').ok, false);
  assert.match(h.compare(sha, sha.replace('ba', 'bb'), 'SHA-256').message, /do NOT match/);
  assert.match(h.compare(sha, '900150983cd24fb0d6963f7d28e17f72', 'SHA-256').message, /looks like MD5/);
  assert.match(h.compare(sha, 'abcd', 'SHA-256').message, /has 4 characters; SHA-256 has 64/);
  assert.equal(h.compare(sha, '', 'SHA-256').ok, null);
  assert.match(h.compare(sha, 'zz'.repeat(32), 'SHA-256').message, /not a hex checksum/);
});

test('uuid v4 and v7 have the right bits and ordering', () => {
  const v4 = h.uuid(env, 4);
  assert.match(v4, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const v7 = h.uuid(env, 7);
  assert.match(v7, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(h.inspect(v7).time, '2026-10-23T06:30:00.000Z');
  const later = h.uuid(Object.assign({}, env, { nowMs: env.nowMs + 5000 }), 7);
  assert.ok(later > v7);
  assert.throws(() => h.uuid(env, 5), /version 4 or 7/);
  assert.equal(new Set(h.uuids(env, 500, 4)).size, 500);
});

test('uuids options and limits', () => {
  assert.match(h.uuids(env, 1, 4, { upper: true })[0], /^[0-9A-F-]{36}$/);
  assert.match(h.uuids(env, 1, 4, { noDashes: true })[0], /^[0-9a-f]{32}$/);
  assert.match(h.uuids(env, 1, 4, { braces: true })[0], /^\{[0-9a-f-]{36}\}$/);
  assert.equal(h.uuids(env, 10, 4).length, 10);
  assert.throws(() => h.uuids(env, 0, 4), /between 1 and 1000/);
  assert.throws(() => h.uuids(env, 1001, 4), /between 1 and 1000/);
});

test('inspect', () => {
  const a = h.inspect('123e4567-e89b-12d3-a456-426614174000');
  assert.deepEqual([a.valid, a.version, a.variant], [true, 1, 'RFC 4122 / RFC 9562']);
  assert.equal(a.time, '2228-06-25T20:01:28.545Z'); // checked against Python's uuid module
  assert.equal(h.inspect('f47ac10b-58cc-4372-a567-0e02b2c3d479').version, 4);
  assert.equal(h.inspect('{F47AC10B-58CC-4372-A567-0E02B2C3D479}').normalised, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  assert.equal(h.inspect('urn:uuid:f47ac10b58cc4372a5670e02b2c3d479').valid, true);
  assert.equal(h.inspect('00000000-0000-0000-0000-000000000000').variant, 'nil');
  assert.equal(h.inspect('nope').valid, false);
  assert.equal(h.inspect('f47ac10b-58cc-4372-a567-0e02b2c3d47').valid, false);
});
