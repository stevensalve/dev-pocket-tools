/**
 * Timestamp Converter - core logic (pure). Uses the browser's built-in time zone database (Intl) so
 * daylight saving is handled correctly. "Now" is always passed in.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimeCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZONES = [
    ['Asia/Kolkata', 'India (IST)'],
    ['UTC', 'UTC'],
    ['Europe/London', 'London'],
    ['Europe/Berlin', 'Central Europe'],
    ['Asia/Dubai', 'Dubai'],
    ['Asia/Singapore', 'Singapore'],
    ['Asia/Tokyo', 'Tokyo'],
    ['Australia/Sydney', 'Sydney'],
    ['America/New_York', 'New York'],
    ['America/Chicago', 'Chicago'],
    ['America/Los_Angeles', 'Los Angeles'],
  ];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const p2 = (n) => String(n).padStart(2, '0');
  const MIN_MS = Date.UTC(1000, 0, 1);
  const MAX_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

  const fmtCache = {};
  function fmt(tz) {
    if (!fmtCache[tz]) {
      try {
        fmtCache[tz] = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hourCycle: 'h23',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'short',
        });
      } catch (e) {
        throw new Error('"' + tz + '" is not a time zone this browser knows.');
      }
    }
    return fmtCache[tz];
  }

  /** Wall-clock fields of an instant in a zone. */
  function fields(ms, tz) {
    const o = {};
    fmt(tz)
      .formatToParts(new Date(ms))
      .forEach((p) => {
        if (p.type !== 'literal') o[p.type] = p.value;
      });
    return { year: +o.year, month: +o.month, day: +o.day, hour: +o.hour, minute: +o.minute, second: +o.second };
  }

  /** Offset of the zone from UTC at that instant, in minutes (IST = 330). */
  function offsetAt(ms, tz) {
    const f = fields(Math.floor(ms / 1000) * 1000, tz);
    return Math.round((Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - Math.floor(ms / 1000) * 1000) / 60000);
  }

  const offsetLabel = (min) => 'UTC' + (min < 0 ? '-' : '+') + p2(Math.floor(Math.abs(min) / 60)) + ':' + p2(Math.abs(min) % 60);

  /** Instant for wall-clock fields in a zone. In a daylight-saving overlap the earlier instant is used; in a gap the time is moved forward. */
  function wallToMs(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s);
    const cands = [offsetAt(guess - 86400000, tz), offsetAt(guess + 86400000, tz)].map((o) => guess - o * 60000);
    const valid = cands.filter((ms) => {
      const f = fields(ms, tz);
      return f.year === y && f.month === mo && f.day === d && f.hour === h && f.minute === mi && f.second === s;
    });
    return valid.length ? Math.min.apply(null, valid) : Math.max.apply(null, cands);
  }

  function validWall(y, mo, d, h, mi, s) {
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && h < 24 && mi < 60 && s < 60;
  }

  /**
   * Understand a typed time. Returns { ms, kind } where kind says how it was read.
   * Accepts: now, Unix seconds / milliseconds / microseconds / nanoseconds (by digit count), ISO 8601 (with or without Z or an offset),
   * "YYYY-MM-DD HH:MM[:SS]", Indian "DD/MM/YYYY [HH:MM[:SS]] [am|pm]", and "23 Oct 2026 14:30".
   * Times without a zone are read in inputZone.
   */
  function parse(text, inputZone, nowMs) {
    const t = String(text === null || text === undefined ? '' : text).trim();
    if (!t) throw new Error('Type a time or a Unix timestamp.');
    const tz = inputZone || 'Asia/Kolkata';
    const done = (ms, kind) => {
      if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) throw new Error('That time is outside the years 1000 to 9999.');
      return { ms: ms, kind: kind };
    };
    if (/^now$/i.test(t)) return done(nowMs, 'now');
    let m;
    if ((m = /^(-?\d+)(?:\.(\d+))?$/.exec(t))) {
      const intPart = m[1].replace('-', '');
      const neg = m[1][0] === '-';
      const digits = intPart.length;
      let ms;
      let kind;
      if (digits <= 11) {
        ms = Number(m[1]) * 1000 + (m[2] ? Math.round(Number('0.' + m[2]) * 1000) * (neg ? -1 : 1) : 0);
        kind = 'Unix seconds';
      } else if (digits <= 14) {
        ms = Number(m[1]);
        kind = 'Unix milliseconds';
      } else if (digits <= 17) {
        ms = Math.floor(Number(m[1]) / 1000);
        kind = 'Unix microseconds';
      } else if (digits <= 20) {
        ms = Math.floor(Number(m[1]) / 1e6);
        kind = 'Unix nanoseconds';
      } else throw new Error('That number has too many digits to be a timestamp.');
      return done(ms, kind);
    }
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(t))) {
      const [y, mo, d, h, mi, s] = [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
      if (!validWall(y, mo, d, h, mi, s)) throw new Error('That is not a real date or time.');
      const frac = m[7] ? Math.floor(Number('0.' + m[7]) * 1000) : 0;
      if (m[8]) {
        const off = /^z$/i.test(m[8]) ? 0 : (m[8][0] === '-' ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(-2)));
        return done(Date.UTC(y, mo - 1, d, h, mi, s) - off * 60000 + frac, /^z$/i.test(m[8]) ? 'ISO 8601 (UTC)' : 'ISO 8601 with offset');
      }
      return done(wallToMs(y, mo, d, h, mi, s, tz) + frac, 'date and time in ' + tz);
    }
    if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i.exec(t))) {
      let h = +(m[4] || 0);
      if (m[7]) {
        if (h < 1 || h > 12) throw new Error('With am/pm the hour must be 1 to 12.');
        h = (h % 12) + (/pm/i.test(m[7]) ? 12 : 0);
      }
      const [d, mo, y, mi, s] = [+m[1], +m[2], +m[3], +(m[5] || 0), +(m[6] || 0)];
      if (!validWall(y, mo, d, h, mi, s)) throw new Error('That is not a real date or time. Dates are read as day/month/year.');
      return done(wallToMs(y, mo, d, h, mi, s, tz), 'DD/MM/YYYY in ' + tz);
    }
    if ((m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i.exec(t))) {
      const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
      if (!mo) throw new Error('"' + m[2] + '" is not a month name.');
      let h = +(m[4] || 0);
      if (m[7]) h = (h % 12) + (/pm/i.test(m[7]) ? 12 : 0);
      const [d, y, mi, s] = [+m[1], +m[3], +(m[5] || 0), +(m[6] || 0)];
      if (!validWall(y, mo, d, h, mi, s)) throw new Error('That is not a real date or time.');
      return done(wallToMs(y, mo, d, h, mi, s, tz), 'date and time in ' + tz);
    }
    throw new Error('This format is not recognised. Try 2026-10-23 14:30, 23/10/2026 14:30, 1761208200 or "now".');
  }

  function relative(ms, nowMs) {
    const diff = Math.round((ms - nowMs) / 1000);
    const a = Math.abs(diff);
    if (a < 5) return 'just now';
    const unit =
      a < 60
        ? [a, 'second']
        : a < 3600
          ? [Math.round(a / 60), 'minute']
          : a < 86400
            ? [Math.round(a / 3600), 'hour']
            : a < 86400 * 60
              ? [Math.round(a / 86400), 'day']
              : a < 86400 * 730
                ? [Math.round(a / (86400 * 30.4375)), 'month']
                : [Math.round(a / (86400 * 365.25)), 'year'];
    const s = unit[0] + ' ' + unit[1] + (unit[0] === 1 ? '' : 's');
    return diff > 0 ? 'in ' + s : s + ' ago';
  }

  /** Show an instant in one zone. */
  function show(ms, tz) {
    const f = fields(ms, tz);
    const off = offsetAt(ms, tz);
    const d = new Date(Date.UTC(f.year, f.month - 1, f.day));
    return {
      zone: tz,
      offset: off,
      offsetLabel: offsetLabel(off),
      date: p2(f.day) + '/' + p2(f.month) + '/' + f.year,
      time: p2(f.hour) + ':' + p2(f.minute) + ':' + p2(f.second),
      iso:
        f.year +
        '-' +
        p2(f.month) +
        '-' +
        p2(f.day) +
        'T' +
        p2(f.hour) +
        ':' +
        p2(f.minute) +
        ':' +
        p2(f.second) +
        (off === 0 ? 'Z' : (off < 0 ? '-' : '+') + p2(Math.floor(Math.abs(off) / 60)) + ':' + p2(Math.abs(off) % 60)),
      weekday: DAYS[d.getUTCDay()],
    };
  }

  /** Everything about an instant: epoch values plus every zone. */
  function describe(ms, nowMs, zones) {
    const sec = Math.floor(ms / 1000);
    return {
      ms: ms,
      seconds: sec,
      milliseconds: ms,
      microseconds: String(BigInt(ms) * 1000n),
      isoUtc: new Date(ms).toISOString(),
      relative: relative(ms, nowMs),
      zones: (zones || ZONES.map((z) => z[0])).map((z) => show(ms, z)),
    };
  }

  /** Difference between two instants. */
  function between(a, b) {
    const total = Math.abs(b - a);
    const days = Math.floor(total / 86400000);
    const hours = Math.floor((total % 86400000) / 3600000);
    const minutes = Math.floor((total % 3600000) / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    return {
      ms: b - a,
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      text: [days && days + ' d', hours && hours + ' h', minutes && minutes + ' min', (seconds || total === 0) && seconds + ' s']
        .filter(Boolean)
        .join(' '),
    };
  }

  return {
    ZONES: ZONES,
    offsetAt: offsetAt,
    offsetLabel: offsetLabel,
    wallToMs: wallToMs,
    parse: parse,
    relative: relative,
    show: show,
    describe: describe,
    between: between,
  };
});
