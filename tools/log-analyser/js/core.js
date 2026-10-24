/**
 * Log Analyser - core logic (pure, no dependencies).
 * Understands JSON lines, logfmt, nginx/Apache access logs and common "timestamp LEVEL message" formats.
 * Times without a zone are read as written (as if UTC), so counts and gaps stay consistent.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  const MAX_CHARS = 20000000;
  const MAX_LINES = 300000;
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function level(word) {
    const w = String(word || '').toUpperCase();
    if (w === 'TRACE') return 'TRACE';
    if (w === 'DEBUG' || w === 'VERBOSE') return 'DEBUG';
    if (w === 'INFO' || w === 'NOTICE') return 'INFO';
    if (w === 'WARN' || w === 'WARNING') return 'WARN';
    if (w === 'ERR' || w === 'ERROR') return 'ERROR';
    if (w === 'FATAL' || w === 'CRIT' || w === 'CRITICAL' || w === 'SEVERE' || w === 'PANIC' || w === 'EMERG' || w === 'ALERT')
      return 'FATAL';
    return null;
  }

  function pinoLevel(n) {
    return n >= 60 ? 'FATAL' : n >= 50 ? 'ERROR' : n >= 40 ? 'WARN' : n >= 30 ? 'INFO' : n >= 20 ? 'DEBUG' : 'TRACE';
  }

  function timeFrom(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    const s = String(v).trim();
    if (/^\d{10}(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
    if (/^\d{13}$/.test(s)) return Number(s);
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
    if (!m) return null;
    let ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + (m[7] ? Math.floor(Number('0.' + m[7]) * 1000) : 0);
    if (m[8] && m[8] !== 'Z') ms -= (m[8][0] === '-' ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(-2))) * 60000;
    return Number.isNaN(ms) ? null : ms;
  }

  const ACCESS =
    /^(\S+) \S+ (\S+) \[(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\] "([A-Z]+) (\S+)[^"]*" (\d{3}) (\d+|-)(?: "[^"]*" "[^"]*")?(?:\s+(\d+(?:\.\d+)?))?/;
  const STAMP = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?\s*(?:Z|[+-]\d{2}:?\d{2})?)\]?[\s,]*/;

  /** Parse one line into an entry, or null when it is not the start of a new entry. */
  function parseLine(line) {
    const l = line.replace(/\r$/, '');
    if (!l.trim()) return null;
    if (l[0] === '{') {
      try {
        const o = JSON.parse(l);
        if (o && typeof o === 'object') {
          const lv = o.level !== undefined ? o.level : o.severity !== undefined ? o.severity : o.lvl;
          const msg = o.msg !== undefined ? o.msg : o.message !== undefined ? o.message : o.event !== undefined ? o.event : '';
          const t = timeFrom(
            o.time !== undefined ? o.time : o.timestamp !== undefined ? o.timestamp : o.ts !== undefined ? o.ts : o['@timestamp'],
          );
          return {
            format: 'json',
            time: t,
            timeText: t === null ? '' : new Date(t).toISOString(),
            level: typeof lv === 'number' ? pinoLevel(lv) : level(lv),
            message: typeof msg === 'string' ? msg : JSON.stringify(msg),
            raw: l,
            extra: [],
          };
        }
      } catch (e) {
        /* fall through to text */
      }
    }
    let m = ACCESS.exec(l);
    if (m) {
      const status = Number(m[12]);
      const off = (m[9][0] === '-' ? -1 : 1) * (Number(m[9].slice(1, 3)) * 60 + Number(m[9].slice(3, 5)));
      const t = Date.UTC(+m[5], MON[m[4].toLowerCase()], +m[3], +m[6], +m[7], +m[8]) - off * 60000;
      return {
        format: 'access',
        time: t,
        timeText: new Date(t).toISOString(),
        level: status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
        message: m[10] + ' ' + m[11] + ' -> ' + status,
        raw: l,
        extra: [],
        access: {
          ip: m[1],
          method: m[10],
          path: m[11].split('?')[0],
          status: status,
          bytes: m[13] === '-' ? 0 : Number(m[13]),
          seconds: m[14] === undefined ? null : Number(m[14]),
        },
      };
    }
    m = STAMP.exec(l);
    let rest = l;
    let t = null;
    let timeText = '';
    if (m) {
      t = timeFrom(m[1]);
      timeText = m[1].replace(',', '.').trim();
      rest = l.slice(m[0].length);
    } else if (
      !/\blevel=\w+/i.test(l) &&
      !/^(?:\[?(?:TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|FATAL|CRITICAL|SEVERE)\]?)[\s:]/.test(l)
    )
      return null;
    let lv = null;
    const lf = /\blevel=("?)(\w+)\1/i.exec(l);
    if (lf) lv = level(lf[2]);
    if (!lv) {
      const w =
        /^[\s[(|-]*(?:[\w.-]+\.)?(TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|FATAL|CRITICAL|SEVERE|PANIC)\b/.exec(rest) ||
        /(?:^|[\s[|:])(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL|SEVERE)(?=[\s\]:|]|$)/.exec(rest.slice(0, 80));
      if (w) lv = level(w[1]);
    }
    if (!m && !lv) return null;
    const msgM = /\bmsg=("([^"]*)"|\S+)/.exec(l);
    const message = msgM
      ? msgM[2] !== undefined
        ? msgM[2]
        : msgM[1]
      : rest
          .replace(
            /^[\s[(|-]*(?:[\w.-]+\.)?(?:TRACE|DEBUG|VERBOSE|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|FATAL|CRITICAL|SEVERE|PANIC)\b[\s\]):|-]*/,
            '',
          )
          .trim();
    return { format: lf ? 'logfmt' : 'text', time: t, timeText: timeText, level: lv, message: message, raw: l, extra: [] };
  }

  /** Text -> { entries, lines, unparsed, truncated }. Lines that do not start an entry are attached to the entry before them (stack traces). */
  function parse(text) {
    const src = String(text === null || text === undefined ? '' : text);
    if (src.length > MAX_CHARS) throw new Error('The text is over 20 million characters: paste a smaller slice.');
    const all = src.split('\n');
    const entries = [];
    let unparsed = 0;
    let truncated = false;
    let nonEmpty = 0;
    for (const raw of all) {
      if (!raw.trim()) continue;
      if (++nonEmpty > MAX_LINES) {
        truncated = true;
        break;
      }
      const e = parseLine(raw);
      if (e) entries.push(e);
      else if (entries.length) entries[entries.length - 1].extra.push(raw.replace(/\r$/, ''));
      else unparsed++;
    }
    return { entries: entries, lines: nonEmpty, unparsed: unparsed, truncated: truncated };
  }

  /** Turn a message into a pattern so repeated errors group together. */
  function pattern(msg) {
    return String(msg)
      .replace(/^\[[^\]]{1,40}\]\s*/, '')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<ip>')
      .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
      .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
      .replace(/"[^"]{0,200}"|'[^']{0,200}'/g, '<text>')
      .replace(/\b\d+(?:\.\d+)?\b/g, '<n>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  const rank = (arr, n) => arr.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, n);

  /** Summary of entries. */
  function analyse(entries) {
    if (!entries.length) throw new Error('No log entries were recognised. Paste lines that start with a date and a level, or JSON lines.');
    const counts = {};
    LEVELS.forEach((l) => (counts[l] = 0));
    counts.UNKNOWN = 0;
    entries.forEach((e) => counts[e.level || 'UNKNOWN']++);
    const times = entries.map((e) => e.time).filter((t) => t !== null);
    const first = times.length ? Math.min.apply(null, times) : null;
    const last = times.length ? Math.max.apply(null, times) : null;
    const span = first === null ? 0 : last - first;
    const unit = span <= 3 * 3600000 ? 60000 : span <= 3 * 86400000 ? 3600000 : 86400000;
    const buckets = {};
    entries.forEach((e) => {
      if (e.time === null) return;
      const b = Math.floor(e.time / unit) * unit;
      const o = (buckets[b] = buckets[b] || { time: b, total: 0, errors: 0 });
      o.total++;
      if (e.level === 'ERROR' || e.level === 'FATAL') o.errors++;
    });
    const timeline = Object.keys(buckets)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => buckets[k]);
    const groups = {};
    entries.forEach((e) => {
      if (e.level !== 'ERROR' && e.level !== 'FATAL' && e.level !== 'WARN') return;
      const key = e.level + ' ' + pattern(e.message);
      const g = (groups[key] = groups[key] || {
        key: key,
        level: e.level,
        pattern: pattern(e.message),
        count: 0,
        first: e.time,
        last: e.time,
        sample: e.message,
        hasTrace: false,
      });
      g.count++;
      if (e.time !== null) {
        g.first = g.first === null ? e.time : Math.min(g.first, e.time);
        g.last = g.last === null ? e.time : Math.max(g.last, e.time);
      }
      if (e.extra.length) g.hasTrace = true;
    });
    const out = {
      total: entries.length,
      levels: counts,
      errorRate: entries.length ? (counts.ERROR + counts.FATAL) / entries.length : 0,
      first: first,
      last: last,
      unit: unit === 60000 ? 'minute' : unit === 3600000 ? 'hour' : 'day',
      timeline: timeline,
      busiest: timeline.length ? timeline.reduce((a, b) => (b.total > a.total ? b : a)) : null,
      worst: timeline.some((b) => b.errors) ? timeline.reduce((a, b) => (b.errors > a.errors ? b : a)) : null,
      topProblems: rank(
        Object.keys(groups).map((k) => groups[k]),
        10,
      ),
      access: null,
    };
    const acc = entries.filter((e) => e.access);
    if (acc.length) {
      const by = (f) => {
        const m = {};
        acc.forEach((e) => {
          const k = f(e.access);
          m[k] = (m[k] || 0) + 1;
        });
        return Object.keys(m).map((k) => ({ key: k, count: m[k] }));
      };
      const by2 = (list) => {
        const m = {};
        list.forEach((e) => {
          const k = e.access.method + ' ' + e.access.path;
          m[k] = (m[k] || 0) + 1;
        });
        return Object.keys(m).map((k) => ({ key: k, count: m[k] }));
      };
      const slow = acc
        .filter((e) => e.access.seconds !== null)
        .sort((a, b) => b.access.seconds - a.access.seconds)
        .slice(0, 5);
      out.access = {
        requests: acc.length,
        status: rank(
          by((a) => Math.floor(a.status / 100) + 'xx'),
          5,
        ),
        paths: rank(
          by((a) => a.method + ' ' + a.path),
          10,
        ),
        clients: rank(
          by((a) => a.ip),
          5,
        ),
        failedPaths: rank(by2(acc.filter((e) => e.access.status >= 500)), 5),
        slowest: slow.map((e) => ({ message: e.message, seconds: e.access.seconds })),
        bytes: acc.reduce((a, e) => a + e.access.bytes, 0),
      };
    }
    return out;
  }

  /** Filter entries. f: { levels: ['ERROR'], text, regex (bool), from, to } */
  function filter(entries, f) {
    const o = f || {};
    let re = null;
    if (o.text) {
      try {
        re = o.regex ? new RegExp(o.text, 'i') : null;
      } catch (e) {
        throw new Error('That search pattern is not a valid regular expression.');
      }
    }
    const q = String(o.text || '').toLowerCase();
    return entries.filter((e) => {
      if (o.levels && o.levels.length && o.levels.indexOf(e.level || 'UNKNOWN') === -1) return false;
      if (o.from !== undefined && o.from !== null && (e.time === null || e.time < o.from)) return false;
      if (o.to !== undefined && o.to !== null && (e.time === null || e.time > o.to)) return false;
      if (q) {
        const hay = e.raw + ' ' + e.extra.join(' ');
        if (re ? !re.test(hay) : hay.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  const formula = /^[=+\-@\t\r]/;
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (formula.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  function toCsv(entries) {
    const rows = [['Time', 'Level', 'Message', 'Format', 'Extra lines']].concat(
      entries.map((e) => [e.timeText, e.level || '', e.message, e.format, e.extra.length]),
    );
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }

  const when = (ms) => (ms === null ? '' : new Date(ms).toISOString().slice(0, 19).replace('T', ' '));

  function toText(a) {
    const L = ['LOG SUMMARY: ' + a.total + ' entries' + (a.first !== null ? ', ' + when(a.first) + ' to ' + when(a.last) : '')];
    L.push(
      'Levels: ' +
        Object.keys(a.levels)
          .filter((k) => a.levels[k])
          .map((k) => k + ' ' + a.levels[k])
          .join(', ') +
        ' (error rate ' +
        (a.errorRate * 100).toFixed(1) +
        '%)',
    );
    if (a.busiest) L.push('Busiest ' + a.unit + ': ' + when(a.busiest.time) + ' (' + a.busiest.total + ' entries)');
    if (a.worst) L.push('Most errors in a ' + a.unit + ': ' + when(a.worst.time) + ' (' + a.worst.errors + ')');
    if (a.topProblems.length) {
      L.push('', 'Top problems:');
      a.topProblems.slice(0, 5).forEach((g) => L.push('- ' + g.count + 'x ' + g.level + ' ' + g.pattern));
    }
    return L.join('\n');
  }

  function sample() {
    return [
      '2026-10-23 09:00:01,120 INFO  [main] Service started on port 8080',
      '2026-10-23 09:00:05,300 INFO  [http-1] GET /orders 200 12ms',
      '2026-10-23 09:01:12,004 WARN  [pool-2] Slow query took 1840 ms: SELECT * FROM orders',
      '2026-10-23 09:01:40,771 ERROR [http-3] Payment failed for order 40213: gateway timeout after 30000 ms',
      'java.net.SocketTimeoutException: Read timed out',
      '\tat com.example.pay.Client.call(Client.java:88)',
      '\tat com.example.pay.Service.charge(Service.java:41)',
      '2026-10-23 09:01:42,100 ERROR [http-4] Payment failed for order 40220: gateway timeout after 30000 ms',
      '2026-10-23 09:02:03,500 INFO  [http-1] GET /orders/40213 200 9ms',
      '2026-10-23 09:02:30,010 ERROR [http-2] Payment failed for order 40231: gateway timeout after 30000 ms',
      '2026-10-23 09:03:15,880 WARN  [pool-2] Slow query took 2210 ms: SELECT * FROM orders',
      '2026-10-23 09:04:00,000 ERROR [worker-1] Cannot connect to cache 10.0.3.14:6379: connection refused',
      '{"time":"2026-10-23T09:04:10Z","level":"error","msg":"queue consumer crashed","attempt":2}',
      '2026-10-23 09:05:01,200 FATAL [main] Out of memory, shutting down',
    ].join('\n');
  }

  return {
    LEVELS: LEVELS,
    parseLine: parseLine,
    parse: parse,
    pattern: pattern,
    analyse: analyse,
    filter: filter,
    toCsv: toCsv,
    toText: toText,
    sample: sample,
  };
});
