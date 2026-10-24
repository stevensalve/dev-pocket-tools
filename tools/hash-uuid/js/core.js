/**
 * Hash & UUID Generator - core logic (pure). SHA-1/256/384/512 and HMAC use the browser's Web Crypto
 * (passed in as env.subtle); MD5 is implemented here because Web Crypto does not offer it.
 * MD5 and SHA-1 are broken for security use: they are included only to check legacy checksums.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HashCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALGOS = [
    { id: 'MD5', bits: 128, legacy: true },
    { id: 'SHA-1', bits: 160, legacy: true },
    { id: 'SHA-256', bits: 256, legacy: false },
    { id: 'SHA-384', bits: 384, legacy: false },
    { id: 'SHA-512', bits: 512, legacy: false },
  ];
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const enc = (s) => new TextEncoder().encode(String(s));

  // ---- MD5 (RFC 1321)
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4,
    11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  function md5(bytes) {
    const len = bytes.length;
    const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
    padded.set(bytes);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, (len << 3) >>> 0, true);
    dv.setUint32(padded.length - 4, Math.floor(len / 0x20000000), true);
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;
      for (let i = 0; i < 64; i++) {
        let F;
        let g;
        if (i < 16) {
          F = (B & C) | (~B & D);
          g = i;
        } else if (i < 32) {
          F = (D & B) | (~D & C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = (7 * i) % 16;
        }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0;
      b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0;
      d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const odv = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => odv.setUint32(i * 4, v, true));
    return out;
  }

  /** Hex digest of bytes. algo is one of MD5, SHA-1, SHA-256, SHA-384, SHA-512. */
  async function digest(env, bytes, algo) {
    if (!ALGOS.some((a) => a.id === algo)) throw new Error('Unknown algorithm.');
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (algo === 'MD5') return hex(md5(b));
    if (!env || !env.subtle) throw new Error('This browser has no Web Crypto, so only MD5 is available here.');
    return hex(new Uint8Array(await env.subtle.digest(algo, b)));
  }

  /** All digests of some text. */
  async function hashText(env, text, algos) {
    const out = {};
    for (const a of algos || ALGOS.map((x) => x.id)) out[a] = await digest(env, enc(text), a);
    return out;
  }

  /** HMAC (SHA-1/256/384/512) of text with a text key, as hex. */
  async function hmac(env, key, text, algo) {
    if (['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'].indexOf(algo) === -1)
      throw new Error('HMAC supports SHA-1, SHA-256, SHA-384 and SHA-512.');
    if (!env || !env.subtle) throw new Error('This browser has no Web Crypto.');
    if (String(key) === '') throw new Error('Type a key first.');
    const k = await env.subtle.importKey('raw', enc(key), { name: 'HMAC', hash: algo }, false, ['sign']);
    return hex(new Uint8Array(await env.subtle.sign('HMAC', k, enc(text))));
  }

  /** Clean up a pasted checksum: accepts "SHA256: ab..", "ab:cd:..", "ab..  filename" and BSD style. Returns { hex, algo|null }. */
  function cleanChecksum(text) {
    let t = String(text || '').trim();
    const bsd = /^(MD5|SHA-?1|SHA-?256|SHA-?384|SHA-?512)\s*\(.*\)\s*=\s*([0-9a-fA-F:\s]+)$/i.exec(t);
    let named = null;
    if (bsd) {
      named = bsd[1].toUpperCase().replace(/^SHA(\d)/, 'SHA-$1');
      t = bsd[2];
    } else {
      const pre = /^(md5|sha-?1|sha-?256|sha-?384|sha-?512)\s*[:=]\s*/i.exec(t);
      if (pre) {
        named = pre[1].toUpperCase().replace(/^SHA(\d)/, 'SHA-$1');
        t = t.slice(pre[0].length);
      }
      t = t.split(/\s+/)[0] || '';
    }
    const h = t.replace(/[:\s]/g, '').toLowerCase();
    const byLen = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }[h.length] || null;
    return { hex: h, algo: named || byLen };
  }

  /** Compare a computed digest with a pasted checksum. */
  function compare(computedHex, pasted, algo) {
    const c = cleanChecksum(pasted);
    if (!c.hex) return { ok: null, message: 'Paste the checksum you were given.' };
    if (!/^[0-9a-f]+$/.test(c.hex)) return { ok: false, message: 'That is not a hex checksum.' };
    const want = ALGOS.find((a) => a.id === algo);
    if (c.algo && c.algo !== algo)
      return {
        ok: false,
        message: 'The pasted checksum looks like ' + c.algo + ', but this is ' + algo + '. Choose ' + c.algo + ' to compare.',
      };
    if (c.hex.length !== want.bits / 4)
      return { ok: false, message: 'The pasted checksum has ' + c.hex.length + ' characters; ' + algo + ' has ' + want.bits / 4 + '.' };
    let diff = 0;
    for (let i = 0; i < c.hex.length; i++) diff |= c.hex.charCodeAt(i) ^ computedHex.charCodeAt(i);
    return diff === 0
      ? { ok: true, message: 'The checksums match.' }
      : { ok: false, message: 'The checksums do NOT match. The file or text is different from what the checksum was made for.' };
  }

  // ---- UUIDs
  const uuidFmt = (b) => {
    const h = hex(b);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  /** Random UUID version 4 or time-ordered version 7. env = { getRandomValues, nowMs }. */
  function uuid(env, version) {
    const b = new Uint8Array(16);
    env.getRandomValues(b);
    if (version === 7) {
      let ms = env.nowMs;
      for (let i = 5; i >= 0; i--) {
        b[i] = ms % 256;
        ms = Math.floor(ms / 256);
      }
      b[6] = (b[6] & 0x0f) | 0x70;
    } else if (version === 4) b[6] = (b[6] & 0x0f) | 0x40;
    else throw new Error('Choose version 4 or 7.');
    b[8] = (b[8] & 0x3f) | 0x80;
    return uuidFmt(b);
  }

  function uuids(env, count, version, opts) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('Ask for between 1 and 1000 UUIDs.');
    const o = opts || {};
    return Array.from({ length: n }, () => {
      let u = uuid(env, version);
      if (o.upper) u = u.toUpperCase();
      if (o.noDashes) u = u.replace(/-/g, '');
      return o.braces ? '{' + u + '}' : u;
    });
  }

  /** Inspect a UUID: { valid, version, variant, time }. */
  function inspect(text) {
    const t = String(text || '')
      .trim()
      .replace(/^urn:uuid:/i, '')
      .replace(/^\{|\}$/g, '');
    const h = t.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(h) || (t.indexOf('-') !== -1 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)))
      return { valid: false, message: 'A UUID is 32 hex digits, usually written 8-4-4-4-12.' };
    if (/^0+$/.test(h))
      return {
        valid: true,
        version: 0,
        variant: 'nil',
        normalised: '00000000-0000-0000-0000-000000000000',
        message: 'The nil UUID (all zeros).',
      };
    const version = parseInt(h[12], 16);
    const v = parseInt(h[16], 16);
    const variant = v < 8 ? 'NCS (reserved)' : v < 12 ? 'RFC 4122 / RFC 9562' : v < 14 ? 'Microsoft (reserved)' : 'reserved';
    const out = {
      valid: true,
      version: version,
      variant: variant,
      normalised: h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20),
    };
    if (version === 7) out.time = new Date(parseInt(h.slice(0, 12), 16)).toISOString();
    if (version === 1) {
      const t100 = (BigInt('0x' + h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8)) - 122192928000000000n) / 10000n;
      out.time = new Date(Number(t100)).toISOString();
    }
    out.message = 'Version ' + version + (out.time ? ', created ' + out.time : '') + ', variant ' + variant + '.';
    return out;
  }

  return {
    ALGOS: ALGOS,
    md5: md5,
    digest: digest,
    hashText: hashText,
    hmac: hmac,
    cleanChecksum: cleanChecksum,
    compare: compare,
    uuid: uuid,
    uuids: uuids,
    inspect: inspect,
  };
});
