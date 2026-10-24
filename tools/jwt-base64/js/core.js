/**
 * JWT & Base64 Decoder - core logic (pure). Everything runs locally; a token or key is never sent anywhere.
 * Signature checks use the browser's built-in Web Crypto (passed in as `subtle`).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JwtCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const enc = (s) => new TextEncoder().encode(s);
  const p2 = (n) => String(n).padStart(2, '0');

  function bytesToB64(bytes, urlSafe, pad) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out +=
        ALPHA[(n >> 18) & 63] +
        ALPHA[(n >> 12) & 63] +
        (i + 1 < bytes.length ? ALPHA[(n >> 6) & 63] : '=') +
        (i + 2 < bytes.length ? ALPHA[n & 63] : '=');
    }
    if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_');
    return pad === false ? out.replace(/=+$/, '') : out;
  }

  function b64ToBytes(text) {
    let s = String(text).replace(/\s+/g, '');
    const urlSafe = /[-_]/.test(s);
    if (/[+/]/.test(s) && urlSafe) throw new Error('This mixes the standard (+ /) and URL-safe (- _) alphabets.');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    if (/=/.test(s.replace(/=+$/, ''))) throw new Error('A "=" appears in the middle: padding is only allowed at the end.');
    s = s.replace(/=+$/, '');
    const bad = /[^A-Za-z0-9+/]/.exec(s);
    if (bad) throw new Error('"' + bad[0] + '" is not a Base64 character.');
    if (s.length % 4 === 1) throw new Error('The length is not valid Base64 (a character is missing or extra).');
    const out = [];
    for (let i = 0; i < s.length; i += 4) {
      const c = [0, 1, 2, 3].map((k) => (i + k < s.length ? ALPHA.indexOf(s[i + k]) : -1));
      const n = (c[0] << 18) | ((c[1] < 0 ? 0 : c[1]) << 12) | ((c[2] < 0 ? 0 : c[2]) << 6) | (c[3] < 0 ? 0 : c[3]);
      out.push((n >> 16) & 255);
      if (c[2] >= 0) out.push((n >> 8) & 255);
      if (c[3] >= 0) out.push(n & 255);
    }
    return { bytes: Uint8Array.from(out), urlSafe: urlSafe };
  }

  /** Encode text (UTF-8) as Base64. opts: { urlSafe, pad }. */
  function b64encode(text, opts) {
    const o = opts || {};
    return bytesToB64(enc(String(text)), !!o.urlSafe, o.pad);
  }

  /** Decode Base64 to text. Returns { text, bytes, urlSafe, isText }. When the bytes are not valid UTF-8, text is a hex dump and isText is false. */
  function b64decode(text) {
    if (!String(text).trim()) throw new Error('There is nothing to decode.');
    const r = b64ToBytes(text);
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(r.bytes), bytes: r.bytes.length, urlSafe: r.urlSafe, isText: true };
    } catch (e) {
      return { text: Array.from(r.bytes, (b) => p2(b.toString(16))).join(' '), bytes: r.bytes.length, urlSafe: r.urlSafe, isText: false };
    }
  }

  function urlEncode(text, mode) {
    const s = String(text);
    return mode === 'full' ? encodeURI(s) : encodeURIComponent(s);
  }

  function urlDecode(text) {
    try {
      return decodeURIComponent(String(text).replace(/\+/g, ' '));
    } catch (e) {
      throw new Error('That is not valid percent-encoding (a % is not followed by two hex digits, or the bytes are not UTF-8).');
    }
  }

  const hexEncode = (text) => Array.from(enc(String(text)), (b) => p2(b.toString(16))).join('');

  function hexDecode(hex) {
    const h = String(hex).replace(/[\s:]|0x/gi, '');
    if (!/^([0-9a-fA-F]{2})*$/.test(h) || !h) throw new Error('Hex must be pairs of 0-9 and a-f.');
    const bytes = Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error('Those bytes are not valid UTF-8 text.');
    }
  }

  /** 'jwt' | 'url' | 'base64' | null: a best guess for what the input is. */
  function detect(input) {
    const t = String(input || '').trim();
    if (!t) return null;
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(t) && t.startsWith('eyJ')) return 'jwt';
    if (/%[0-9a-fA-F]{2}/.test(t)) return 'url';
    if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(t.replace(/\s+/g, '')) && t.replace(/\s+/g, '').length >= 4) return 'base64';
    return null;
  }

  /** Seconds since 1970 -> { utc, ist, iso }. */
  function formatTime(sec) {
    const d = new Date(sec * 1000);
    if (isNaN(d)) return null;
    const iso = d.toISOString();
    const ist = new Date(sec * 1000 + 330 * 60000).toISOString();
    return {
      iso: iso,
      utc: iso.slice(0, 10) + ' ' + iso.slice(11, 19) + ' UTC',
      ist: ist.slice(8, 10) + '/' + ist.slice(5, 7) + '/' + ist.slice(0, 4) + ' ' + ist.slice(11, 19) + ' IST',
    };
  }

  function span(sec) {
    const a = Math.abs(sec);
    if (a < 60) return a + ' seconds';
    if (a < 3600) return Math.round(a / 60) + ' minutes';
    if (a < 172800) return Math.round(a / 3600) + ' hours';
    return Math.round(a / 86400) + ' days';
  }

  function part(text, name) {
    let r;
    try {
      r = b64decode(text);
    } catch (e) {
      throw new Error('The ' + name + ' is not valid Base64: ' + e.message);
    }
    try {
      const v = JSON.parse(r.text);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
      return v;
    } catch (e) {
      throw new Error('The ' + name + ' is not a JSON object.');
    }
  }

  /** Decode a JWT without trusting it. nowSec is passed in. */
  function decodeJwt(token, nowSec) {
    const t = String(token || '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .replace(/\s+/g, '');
    if (!t) throw new Error('Paste a token first.');
    const parts = t.split('.');
    if (parts.length === 5)
      throw new Error('This looks like an encrypted token (JWE, five parts). Its contents cannot be read without the key.');
    if (parts.length !== 3) throw new Error('A JWT has three parts separated by dots, but this has ' + parts.length + '.');
    const header = part(parts[0], 'header');
    const payload = part(parts[1], 'payload');
    const alg = String(header.alg || '');
    const notes = [];
    const claims = [];
    ['iat', 'nbf', 'exp'].forEach((k) => {
      if (payload[k] === undefined) return;
      const v = payload[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) return notes.push('The "' + k + '" claim is not a number.');
      if (v > 1e11) notes.push('The "' + k + '" claim looks like milliseconds; JWT times are in seconds.');
      const f = formatTime(v);
      if (f) claims.push({ claim: k, value: v, utc: f.utc, ist: f.ist });
    });
    let status = 'no-expiry';
    let statusText = 'The token has no expiry (exp) claim.';
    const exp = payload.exp;
    if (typeof exp === 'number') {
      if (nowSec >= exp) {
        status = 'expired';
        statusText = 'Expired ' + span(nowSec - exp) + ' ago.';
      } else if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
        status = 'not-yet';
        statusText = 'Not valid yet: starts in ' + span(payload.nbf - nowSec) + '.';
      } else {
        status = 'valid';
        statusText = 'Not expired: ' + span(exp - nowSec) + ' left.';
      }
    } else if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
      status = 'not-yet';
      statusText = 'Not valid yet: starts in ' + span(payload.nbf - nowSec) + '.';
    }
    const warnings = [
      'The signature has NOT been checked. Anyone can create a token with any contents: never trust it until it is verified.',
    ];
    if (alg.toLowerCase() === 'none' || parts[2] === '') warnings.push('This token is unsigned (alg none or an empty signature).');
    if (!alg) warnings.push('The header has no "alg".');
    if (typeof payload.exp === 'number' && typeof payload.iat === 'number' && payload.exp - payload.iat > 365 * 86400)
      warnings.push('The token lives for more than a year.');
    if (payload.exp === undefined) warnings.push('There is no expiry: a leaked token would work forever.');
    return {
      header: header,
      payload: payload,
      alg: alg,
      claims: claims,
      status: status,
      statusText: statusText,
      notes: notes,
      warnings: warnings,
      signature: parts[2],
      signingInput: parts[0] + '.' + parts[1],
    };
  }

  const HASH = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };

  function pemToDer(pem) {
    const body = String(pem)
      .replace(/-----[^-]+-----/g, '')
      .replace(/\s+/g, '');
    if (!body) throw new Error('Paste the public key including its BEGIN and END lines.');
    return b64ToBytes(body).bytes;
  }

  /**
   * Check the signature. HS256/384/512: key is the shared secret text.
   * RS256/384/512 and ES256/384: key is a PEM public key ("BEGIN PUBLIC KEY").
   * Returns { ok, alg } or throws with a reason.
   */
  async function verify(subtle, token, key) {
    const d = decodeJwt(token, 0);
    const alg = d.alg;
    const m = /^(HS|RS|ES)(256|384|512)$/.exec(alg);
    if (!m)
      throw new Error(
        alg.toLowerCase() === 'none'
          ? 'This token is unsigned: there is no signature to check.'
          : 'The algorithm "' + alg + '" is not supported here (HS256/384/512, RS256/384/512 and ES256/384 are).',
      );
    if (!subtle) throw new Error('This browser has no Web Crypto, so signatures cannot be checked here.');
    if (!String(key || '').trim()) throw new Error(m[1] === 'HS' ? 'Type the secret.' : 'Paste the public key.');
    const sig = b64ToBytes(d.signature).bytes;
    const data = enc(d.signingInput);
    const hash = HASH[m[2]];
    let k;
    let algo;
    if (m[1] === 'HS') {
      k = await subtle.importKey('raw', enc(String(key)), { name: 'HMAC', hash: hash }, false, ['verify']);
      algo = 'HMAC';
    } else if (m[1] === 'RS') {
      try {
        k = await subtle.importKey('spki', pemToDer(key), { name: 'RSASSA-PKCS1-v1_5', hash: hash }, false, ['verify']);
      } catch (e) {
        throw new Error('That is not a usable RSA public key (it must be a "BEGIN PUBLIC KEY" block).');
      }
      algo = 'RSASSA-PKCS1-v1_5';
    } else {
      if (m[2] === '512') throw new Error('ES512 is not supported here.');
      try {
        k = await subtle.importKey('spki', pemToDer(key), { name: 'ECDSA', namedCurve: 'P-' + m[2] }, false, ['verify']);
      } catch (e) {
        throw new Error(
          'That is not a usable EC public key for ' + alg + ' (it must be a "BEGIN PUBLIC KEY" block on curve P-' + m[2] + ').',
        );
      }
      algo = { name: 'ECDSA', hash: hash };
    }
    const ok = await subtle.verify(algo, k, sig, data);
    return { ok: ok, alg: alg };
  }

  function sampleToken(nowSec) {
    const h = bytesToB64(enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), true, false);
    const p = bytesToB64(
      enc(
        JSON.stringify({
          sub: '1234567890',
          name: 'Asha Rao',
          iss: 'https://auth.example.com',
          aud: 'orders-api',
          iat: nowSec - 600,
          exp: nowSec + 3000,
        }),
      ),
      true,
      false,
    );
    return h + '.' + p + '.' + 'c2lnbmF0dXJlLW5vdC12ZXJpZmllZA';
  }

  return {
    b64encode: b64encode,
    b64decode: b64decode,
    urlEncode: urlEncode,
    urlDecode: urlDecode,
    hexEncode: hexEncode,
    hexDecode: hexDecode,
    detect: detect,
    formatTime: formatTime,
    decodeJwt: decodeJwt,
    verify: verify,
    sampleToken: sampleToken,
  };
});
