/**
 * JSON / YAML / XML Converter - core logic (pure).
 * The YAML and XML libraries are passed in as `libs` so Node tests use the exact bundled copies:
 *   libs = { yaml, XMLParser, XMLBuilder, XMLValidator }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DataCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMATS = ['json', 'yaml', 'xml'];
  const MAX_CHARS = 5000000;

  function detect(text) {
    const t = String(text || '')
      .replace(/^\ufeff/, '')
      .trim();
    if (!t) return null;
    if (t[0] === '{' || t[0] === '[') return 'json';
    if (t[0] === '<') return 'xml';
    return 'yaml';
  }

  function lineCol(text, pos) {
    const before = text.slice(0, pos);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  /** Find the first syntax error in JSON text: { pos, msg } or null. (Engines word and position their own messages differently.) */
  function jsonError(src) {
    let i = 0;
    const n = src.length;
    const ws = () => {
      while (i < n && /[ \t\r\n]/.test(src[i])) i++;
    };
    const bad = (msg) => ({ pos: Math.min(i, n), msg: msg });
    const show = () => (i >= n ? 'the end of the text' : "'" + src[i] + "'");
    function value(depth) {
      if (depth > 500) return bad('nesting is too deep');
      ws();
      if (i >= n) return bad('unexpected end of the text');
      const c = src[i];
      if (c === '{') {
        i++;
        ws();
        if (src[i] === '}') return (i++, null);
        for (;;) {
          ws();
          if (src[i] !== '"') return bad('expected a quoted property name but found ' + show());
          let e = str();
          if (e) return e;
          ws();
          if (src[i] !== ':') return bad("expected ':' but found " + show());
          i++;
          e = value(depth + 1);
          if (e) return e;
          ws();
          if (src[i] === ',') {
            i++;
            continue;
          }
          if (src[i] === '}') return (i++, null);
          return bad("expected ',' or '}' but found " + show());
        }
      }
      if (c === '[') {
        i++;
        ws();
        if (src[i] === ']') return (i++, null);
        for (;;) {
          const e = value(depth + 1);
          if (e) return e;
          ws();
          if (src[i] === ',') {
            i++;
            continue;
          }
          if (src[i] === ']') return (i++, null);
          return bad("expected ',' or ']' but found " + show());
        }
      }
      if (c === '"') return str();
      const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i, i + 400));
      if (m) return ((i += m[0].length), null);
      return bad('unexpected ' + show());
    }
    function str() {
      i++;
      while (i < n) {
        const c = src[i];
        if (c === '"') return (i++, null);
        if (c === '\\') i += src[i + 1] === 'u' ? 6 : 2;
        else if (c < ' ') return bad('a line break or control character inside a string');
        else i++;
      }
      return bad('the string is not closed');
    }
    const e = value(0);
    if (e) return e;
    ws();
    return i < n ? bad('unexpected ' + show() + ' after the end of the data') : null;
  }

  /** Parse text in the given format into a JavaScript value. Throws a plain-language Error with line and column when possible. */
  function parse(libs, text, format) {
    const src = String(text === null || text === undefined ? '' : text).replace(/^\ufeff/, '');
    if (!src.trim()) throw new Error('There is nothing to read: the input is empty.');
    if (src.length > MAX_CHARS) throw new Error('The input is over 5 million characters: use a smaller sample.');
    if (FORMATS.indexOf(format) === -1) throw new Error('Unknown format.');
    if (format === 'json') {
      try {
        return JSON.parse(src);
      } catch (e) {
        const je = jsonError(src);
        const lc = je ? lineCol(src, je.pos) : null;
        throw new Error(
          'Not valid JSON' + (lc ? ' (line ' + lc.line + ', column ' + lc.col + '): ' + je.msg : ': ' + e.message.split('\n')[0]),
        );
      }
    }
    if (format === 'yaml') {
      try {
        return libs.yaml.load(src);
      } catch (e) {
        const line = e.mark && Number.isInteger(e.mark.line) ? e.mark.line + 1 : null;
        const col = e.mark && Number.isInteger(e.mark.column) ? e.mark.column + 1 : null;
        const reason = String(e.reason || e.message).split('\n')[0];
        throw new Error(
          'Not valid YAML' +
            (line ? ' (line ' + line + (col ? ', column ' + col : '') + ')' : '') +
            ': ' +
            reason +
            (/multiple documents|expected a single document/i.test(reason) ? '. Only one document at a time is supported.' : ''),
        );
      }
    }
    if (/<!DOCTYPE/i.test(src))
      throw new Error(
        'XML with a DOCTYPE is not supported (it can define entities that expand without limit). Remove the DOCTYPE line first.',
      );
    const v = libs.XMLValidator.default ? libs.XMLValidator.default.validate(src) : libs.XMLValidator.validate(src);
    if (v !== true) throw new Error('Not valid XML (line ' + v.err.line + ', column ' + v.err.col + '): ' + v.err.msg);
    const P = libs.XMLParser.default || libs.XMLParser;
    return new P({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      processEntities: true,
    }).parse(src);
  }

  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object')
      return Object.keys(v)
        .sort()
        .reduce((o, k) => ((o[k] = sortKeys(v[k])), o), {});
    return v;
  }

  /** Write a value in the given format. opts: { indent: 2 | 4 | 'tab', sort: bool, minify: bool (json only), root: 'root' }. */
  function stringify(libs, value, format, opts) {
    const o = opts || {};
    const v = o.sort ? sortKeys(value) : value;
    const indent = o.indent === 'tab' ? '\t' : o.indent === 4 ? 4 : 2;
    if (format === 'json') {
      const s = o.minify ? JSON.stringify(v) : JSON.stringify(v, null, indent);
      if (s === undefined) throw new Error('That value cannot be written as JSON.');
      return s;
    }
    if (format === 'yaml') {
      if (v === undefined) throw new Error('That value cannot be written as YAML.');
      return libs.yaml.dump(v, { indent: indent === '\t' ? 2 : indent, lineWidth: -1, noRefs: true });
    }
    if (format === 'xml') {
      const B = libs.XMLBuilder.default || libs.XMLBuilder;
      const rootName = /^[A-Za-z_][\w.-]*$/.test(o.root || '') ? o.root : 'root';
      let obj = v;
      const single = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && !/^[@#]/.test(Object.keys(v)[0]);
      if (!single) obj = { [rootName]: v };
      const b = new B({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: !o.minify,
        indentBy: indent === '\t' ? '\t' : ' '.repeat(indent),
        suppressEmptyNode: true,
      });
      return b.build(obj).replace(/\n$/, '');
    }
    throw new Error('Unknown format.');
  }

  /** Convert text from one format to another. */
  function convert(libs, text, from, to, opts) {
    const f = from === 'auto' ? detect(text) : from;
    if (!f) throw new Error('There is nothing to read: the input is empty.');
    const value = parse(libs, text, f);
    return { from: f, to: to, value: value, output: stringify(libs, value, to, opts) };
  }

  /** Counts for a quick summary of a parsed value. */
  function stats(value) {
    const s = { objects: 0, arrays: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, depth: 0, keys: 0 };
    (function walk(v, d) {
      if (d > s.depth) s.depth = d;
      if (Array.isArray(v)) {
        s.arrays++;
        v.forEach((x) => walk(x, d + 1));
      } else if (v && typeof v === 'object') {
        s.objects++;
        Object.keys(v).forEach((k) => {
          s.keys++;
          walk(v[k], d + 1);
        });
      } else if (v === null) s.nulls++;
      else if (typeof v === 'string') s.strings++;
      else if (typeof v === 'number') s.numbers++;
      else if (typeof v === 'boolean') s.booleans++;
    })(value, 0);
    return s;
  }

  function tokens(path) {
    const p = String(path || '')
      .trim()
      .replace(/^\$/, '');
    const out = [];
    const re = /\.\.?\s*([^.[\]]+)|\[\s*(?:'([^']*)'|"([^"]*)"|(\*|-?\d+))\s*\]|^([^.[\]]+)/g;
    let m;
    let last = 0;
    while ((m = re.exec(p))) {
      if (m.index !== last) throw new Error('The path is not valid near "' + p.slice(last, m.index + 1) + '".');
      last = re.lastIndex;
      const key = m[1] !== undefined ? m[1].trim() : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[5];
      if (m[4] !== undefined) out.push(m[4] === '*' ? { any: true } : { index: Number(m[4]) });
      else if (key === '*') out.push({ any: true });
      else out.push({ key: key });
    }
    if (last !== p.length) throw new Error('The path is not valid near "' + p.slice(last) + '".');
    return out;
  }

  /** Simple path query: $.users[0].name, users.*.name, $['a b'][*]. Returns [{ path, value }]. */
  function query(value, path) {
    const toks = tokens(path);
    let hits = [{ path: '$', value: value }];
    toks.forEach((t) => {
      const next = [];
      hits.forEach((h) => {
        const v = h.value;
        if (t.any) {
          if (Array.isArray(v)) v.forEach((x, i) => next.push({ path: h.path + '[' + i + ']', value: x }));
          else if (v && typeof v === 'object') Object.keys(v).forEach((k) => next.push({ path: h.path + '.' + k, value: v[k] }));
        } else if (t.index !== undefined) {
          if (Array.isArray(v)) {
            const i = t.index < 0 ? v.length + t.index : t.index;
            if (i >= 0 && i < v.length) next.push({ path: h.path + '[' + i + ']', value: v[i] });
          }
        } else if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, t.key))
          next.push({ path: h.path + '.' + t.key, value: v[t.key] });
        else if (Array.isArray(v) && /^\d+$/.test(t.key) && Number(t.key) < v.length)
          next.push({ path: h.path + '[' + t.key + ']', value: v[Number(t.key)] });
      });
      hits = next;
    });
    return hits;
  }

  function sample(format) {
    const v = {
      service: 'orders',
      version: '1.4.2',
      replicas: 3,
      enabled: true,
      owners: ['asha', 'ravi'],
      limits: { cpu: '500m', memory: '256Mi' },
      endpoints: [
        { path: '/orders', method: 'GET' },
        { path: '/orders/{id}', method: 'DELETE' },
      ],
    };
    return { value: v, text: format === 'json' ? JSON.stringify(v, null, 2) : null };
  }

  return {
    FORMATS: FORMATS,
    detect: detect,
    parse: parse,
    stringify: stringify,
    convert: convert,
    stats: stats,
    query: query,
    sample: sample,
  };
});
