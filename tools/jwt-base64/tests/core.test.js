'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const j = require('../js/core.js');

const subtle = globalThis.crypto.subtle;
const JWT_IO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

test('base64 encode: standard, URL-safe, padding, UTF-8', () => {
  assert.equal(j.b64encode('Hello'), 'SGVsbG8=');
  assert.equal(j.b64encode('Hello', { pad: false }), 'SGVsbG8');
  assert.equal(j.b64encode('ÿþ?>>', { urlSafe: true }), j.b64encode('ÿþ?>>').replace(/\+/g, '-').replace(/\//g, '_'));
  assert.equal(j.b64encode('नमस्ते'), Buffer.from('नमस्ते').toString('base64'));
  assert.equal(j.b64encode(''), '');
  assert.equal(j.b64encode('a'), Buffer.from('a').toString('base64'));
  assert.equal(j.b64encode('ab'), Buffer.from('ab').toString('base64'));
});

test('base64 decode: round trip, no padding, whitespace, URL-safe, binary', () => {
  assert.equal(j.b64decode('SGVsbG8=').text, 'Hello');
  assert.equal(j.b64decode('SGVsbG8').text, 'Hello');
  assert.equal(j.b64decode('SGVs\nbG8=').text, 'Hello');
  const u = j.b64decode(Buffer.from('<<???>>>').toString('base64url'));
  assert.equal(u.text, '<<???>>>');
  assert.equal(u.urlSafe, true);
  assert.equal(j.b64decode(j.b64encode('नमस्ते 😀')).text, 'नमस्ते 😀');
  const bin = j.b64decode('/+8=');
  assert.deepEqual([bin.isText, bin.text, bin.bytes], [false, 'ff ef', 2]);
});

test('base64 decode errors', () => {
  assert.throws(() => j.b64decode(''), /nothing to decode/);
  assert.throws(() => j.b64decode('SGV$bG8='), /"\$" is not a Base64 character/);
  assert.throws(() => j.b64decode('SGVsb'), /length is not valid/);
  assert.throws(() => j.b64decode('SG=sbG8='), /middle/);
  assert.throws(() => j.b64decode('a+b-c_'), /mixes/);
});

test('url and hex helpers', () => {
  assert.equal(j.urlEncode('a b&c/d?é'), 'a%20b%26c%2Fd%3F%C3%A9');
  assert.equal(j.urlEncode('http://x.com/a b?q=é', 'full'), 'http://x.com/a%20b?q=%C3%A9');
  assert.equal(j.urlDecode('a%20b%26c+d'), 'a b&c d');
  assert.throws(() => j.urlDecode('%E0%A4%A'), /not valid percent-encoding/);
  assert.equal(j.hexEncode('Hi!'), '486921');
  assert.equal(j.hexDecode('48 69:21'), 'Hi!');
  assert.equal(j.hexDecode('0x486921'), 'Hi!');
  assert.throws(() => j.hexDecode('4'), /pairs/);
  assert.throws(() => j.hexDecode('ff'), /not valid UTF-8/);
});

test('detect', () => {
  assert.equal(j.detect(JWT_IO), 'jwt');
  assert.equal(j.detect('a%20b'), 'url');
  assert.equal(j.detect('SGVsbG8='), 'base64');
  assert.equal(j.detect('hello world!'), null);
  assert.equal(j.detect(''), null);
});

test('formatTime in UTC and IST', () => {
  const f = j.formatTime(1516239022);
  assert.equal(f.utc, '2018-01-18 01:30:22 UTC');
  assert.equal(f.ist, '18/01/2018 07:00:22 IST');
  assert.equal(j.formatTime(NaN), null);
});

test('decodeJwt: jwt.io example', () => {
  const d = j.decodeJwt(JWT_IO, 1516239022 + 100);
  assert.deepEqual(d.header, { alg: 'HS256', typ: 'JWT' });
  assert.equal(d.payload.name, 'John Doe');
  assert.equal(d.alg, 'HS256');
  assert.equal(d.status, 'no-expiry');
  assert.ok(d.warnings[0].includes('NOT been checked'));
  assert.ok(d.warnings.some((w) => /no expiry/.test(w)));
  assert.equal(d.claims[0].claim, 'iat');
  assert.equal(j.decodeJwt('Bearer ' + JWT_IO, 0).alg, 'HS256');
});

test('decodeJwt: expiry states and notes', () => {
  const now = 1800000000;
  const s = j.decodeJwt(j.sampleToken(now), now);
  assert.equal(s.status, 'valid');
  assert.equal(s.statusText, 'Not expired: 50 minutes left.');
  assert.equal(j.decodeJwt(j.sampleToken(now), now + 4000).status, 'expired');
  assert.match(j.decodeJwt(j.sampleToken(now), now + 4000).statusText, /^Expired 17 minutes ago/);
  const mk = (p, alg) =>
    j.b64encode(JSON.stringify({ alg: alg || 'HS256' }), { urlSafe: true, pad: false }) +
    '.' +
    j.b64encode(JSON.stringify(p), { urlSafe: true, pad: false }) +
    '.';
  const nb = j.decodeJwt(mk({ nbf: now + 7200, exp: now + 9000 }, 'none'), now);
  assert.equal(nb.status, 'not-yet');
  assert.ok(nb.warnings.some((w) => /unsigned/.test(w)));
  assert.ok(j.decodeJwt(mk({ exp: now * 1000 }), now).notes.some((n) => /milliseconds/.test(n)));
  assert.ok(j.decodeJwt(mk({ iat: now, exp: now + 400 * 86400 }), now).warnings.some((w) => /more than a year/.test(w)));
  assert.ok(j.decodeJwt(mk({ exp: 'soon' }), now).statusText.includes('no expiry'));
});

test('decodeJwt errors', () => {
  assert.throws(() => j.decodeJwt('', 0), /Paste a token/);
  assert.throws(() => j.decodeJwt('a.b', 0), /three parts .* has 2/);
  assert.throws(() => j.decodeJwt('a.b.c.d.e', 0), /encrypted token/);
  assert.throws(() => j.decodeJwt('!!!.e30.x', 0), /header is not valid Base64/);
  assert.throws(() => j.decodeJwt('W10.e30.x', 0), /header is not a JSON object/);
  assert.throws(() => j.decodeJwt('e30.bm90anNvbg.x', 0), /payload is not a JSON object/);
});

test('verify HS256 with the jwt.io secret', async () => {
  assert.deepEqual(await j.verify(subtle, JWT_IO, 'your-256-bit-secret'), { ok: true, alg: 'HS256' });
  assert.equal((await j.verify(subtle, JWT_IO, 'wrong secret')).ok, false);
  await assert.rejects(j.verify(subtle, JWT_IO, ''), /Type the secret/);
  await assert.rejects(j.verify(null, JWT_IO, 'x'), /no Web Crypto/);
});

test('verify RS256 and ES256 against Node-signed tokens', async () => {
  const rsa = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ec = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const make = (alg, key, opts) => {
    const h = j.b64encode(JSON.stringify({ alg: alg }), { urlSafe: true, pad: false });
    const p = j.b64encode(JSON.stringify({ sub: 'x' }), { urlSafe: true, pad: false });
    const sig = nodeCrypto.sign('sha256', Buffer.from(h + '.' + p), Object.assign({ key: key }, opts)).toString('base64url');
    return h + '.' + p + '.' + sig;
  };
  const rsPem = rsa.publicKey.export({ type: 'spki', format: 'pem' });
  const esPem = ec.publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal((await j.verify(subtle, make('RS256', rsa.privateKey), rsPem)).ok, true);
  assert.equal((await j.verify(subtle, make('ES256', ec.privateKey, { dsaEncoding: 'ieee-p1363' }), esPem)).ok, true);
  const other = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal((await j.verify(subtle, make('RS256', rsa.privateKey), other)).ok, false);
  await assert.rejects(j.verify(subtle, make('RS256', rsa.privateKey), 'not a key'), /not a usable RSA public key/);
  await assert.rejects(j.verify(subtle, make('ES256', ec.privateKey, { dsaEncoding: 'ieee-p1363' }), rsPem), /not a usable EC public key/);
});

test('verify: unsupported and unsigned', async () => {
  const mk = (alg) => j.b64encode(JSON.stringify({ alg: alg }), { urlSafe: true, pad: false }) + '.e30.';
  await assert.rejects(j.verify(subtle, mk('none'), 'x'), /unsigned/);
  await assert.rejects(j.verify(subtle, mk('PS256'), 'x'), /"PS256" is not supported/);
});
