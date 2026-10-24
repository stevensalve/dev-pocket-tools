/**
 * URL & Query Parser - core logic (pure; uses the standard URL class).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UrlCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_PORTS = { 'http:': '80', 'https:': '443', 'ftp:': '21', 'ws:': '80', 'wss:': '443' };
  const SENSITIVE =
    /(^|[_-])(token|key|apikey|api_key|secret|password|passwd|pwd|auth|authorization|signature|sig|session|sessionid|jwt|code|otp|credential)s?($|[_-])/i;

  function safeDecode(s) {
    try {
      return decodeURIComponent(s.replace(/\+/g, ' '));
    } catch (e) {
      return s;
    }
  }

  /** Read a URL. A missing scheme gets https://. Returns the parts, query parameters and notes. A password is never echoed back. */
  function parse(text) {
    return read(text).parts;
  }

  function read(text) {
    let raw = String(text === null || text === undefined ? '' : text).trim();
    if (!raw) throw new Error('Paste a URL first.');
    if (/\s/.test(raw)) throw new Error('A URL cannot contain spaces: encode them as %20.');
    const notes = [];
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) || /^[a-z0-9.-]+:\d+(\/|$)/i.test(raw)) {
      raw = 'https://' + raw.replace(/^\/\//, '');
      notes.push('No scheme was typed, so https:// was assumed.');
    }
    let u;
    try {
      u = new URL(raw);
    } catch (e) {
      throw new Error('That is not a valid URL.');
    }
    const params = [];
    const rawQuery = u.search.replace(/^\?/, '');
    u.searchParams.forEach((value, key) => params.push({ key: key, value: value }));
    const warnings = [];
    if (u.username || u.password) warnings.push('The URL contains a user name or password. Anyone who sees the URL sees them.');
    const risky = params.filter((p) => SENSITIVE.test(p.key)).map((p) => p.key);
    if (risky.length)
      warnings.push(
        'These parameters look like secrets: ' +
          Array.from(new Set(risky)).join(', ') +
          '. URLs end up in logs, history and referrers: avoid sharing or logging this one.',
      );
    if (/%25[0-9a-f]{2}/i.test(rawQuery) || /%25[0-9a-f]{2}/i.test(u.pathname))
      warnings.push('Part of this URL looks double-encoded (a %25 followed by two hex digits).');
    if (u.protocol === 'http:') warnings.push('The URL uses http, not https.');
    const keys = params.map((p) => p.key);
    const dups = Array.from(new Set(keys.filter((k, i) => keys.indexOf(k) !== i)));
    if (dups.length) notes.push('Repeated parameters: ' + dups.join(', ') + '.');
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || /^\[.*\]$/.test(u.hostname);
    let shown = u.href;
    if (u.password) {
      const m = new URL(u.href);
      m.password = '***';
      shown = m.href;
    }
    const parts = {
      href: shown,
      protocol: u.protocol.replace(':', ''),
      username: safeDecode(u.username),
      password: u.password ? '(hidden: ' + u.password.length + ' characters)' : '',
      hostname: u.hostname,
      port: u.port,
      effectivePort: u.port || DEFAULT_PORTS[u.protocol] || '',
      origin: u.origin === 'null' ? '' : u.origin,
      pathname: u.pathname,
      segments: u.pathname.split('/').filter(Boolean).map(safeDecode),
      search: u.search,
      params: params,
      hash: u.hash,
      isIp: isIp,
      notes: notes,
      warnings: warnings,
    };
    return { u: u, parts: parts };
  }

  /** Put a URL back together with changed query parameters. params = [{ key, value }]; blank keys are skipped. */
  function rebuild(text, params, hash) {
    const u = new URL(read(text).u.href);
    u.search = '';
    (params || []).forEach((x) => {
      if (String(x.key).trim() !== '') u.searchParams.append(String(x.key), String(x.value === undefined ? '' : x.value));
    });
    if (hash !== undefined) u.hash = hash;
    return u.href;
  }

  const sortParams = (params) => params.slice().sort((a, b) => a.key.localeCompare(b.key) || 0);

  /** Remove tracking parameters (utm_*, fbclid, gclid and similar). Returns { params, removed }. */
  function stripTracking(params) {
    const t = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|ref_src|ref)$/i;
    return { params: params.filter((p) => !t.test(p.key)), removed: params.filter((p) => t.test(p.key)).map((p) => p.key) };
  }

  /** Query parameters as an object; repeated keys become arrays. */
  function toObject(params) {
    const o = {};
    params.forEach((p) => {
      if (Object.prototype.hasOwnProperty.call(o, p.key)) o[p.key] = [].concat(o[p.key], p.value);
      else o[p.key] = p.value;
    });
    return o;
  }

  /** Object -> parameters (arrays repeat the key). Values become strings. */
  function fromObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Give a JSON object like {"a":"1","b":["x","y"]}.');
    const out = [];
    Object.keys(obj).forEach((k) =>
      (Array.isArray(obj[k]) ? obj[k] : [obj[k]]).forEach((v) =>
        out.push({ key: k, value: v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v) }),
      ),
    );
    return out;
  }

  /** Resolve a relative reference against a base URL. */
  function resolve(base, relative) {
    const b = read(base);
    try {
      return new URL(String(relative).trim(), b.u.href).href;
    } catch (e) {
      throw new Error('That relative address cannot be resolved against the base.');
    }
  }

  function sample() {
    return 'https://user@shop.example.com:8443/en-in/products/running%20shoes?utm_source=newsletter&utm_medium=email&utm_campaign=diwali-sale&size=9&size=10&token=abc123&q=caf%C3%A9#reviews';
  }

  return {
    parse: parse,
    rebuild: rebuild,
    sortParams: sortParams,
    stripTracking: stripTracking,
    toObject: toObject,
    fromObject: fromObject,
    resolve: resolve,
    sample: sample,
  };
});
