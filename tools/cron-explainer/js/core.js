/**
 * Cron Explainer - core logic (pure, no dependencies).
 * Standard five-field cron: minute hour day-of-month month day-of-week.
 * Times are wall-clock times in the schedule's own time zone; daylight-saving changes are not applied.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CronCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MACROS = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@midnight': '0 0 * * *',
    '@hourly': '0 * * * *',
  };
  const SPEC = [
    { key: 'minute', min: 0, max: 59 },
    { key: 'hour', min: 0, max: 23 },
    { key: 'dom', min: 1, max: 31 },
    { key: 'month', min: 1, max: 12, names: MONTHS.map((m) => m.slice(0, 3).toLowerCase()), offset: 1 },
    { key: 'dow', min: 0, max: 7, names: DAYS.map((d) => d.slice(0, 3).toLowerCase()), offset: 0 },
  ];
  const p2 = (n) => String(n).padStart(2, '0');

  function parseField(text, spec) {
    const label = spec.key === 'dom' ? 'day-of-month' : spec.key === 'dow' ? 'day-of-week' : spec.key;
    if (
      /[LW#]/i.test(text) &&
      !(spec.names && spec.names.indexOf(text.toLowerCase()) !== -1) &&
      !/^[a-z]{3}(?:[-,][a-z]{3})*$/i.test(text.replace(/\/\d+$/, ''))
    )
      throw new Error('The ' + label + ' field uses L, W or #, which are Quartz extensions and not standard cron.');
    const toNum = (tok) => {
      if (/^\d+$/.test(tok)) return Number(tok);
      if (spec.names) {
        const i = spec.names.indexOf(tok.toLowerCase());
        if (i !== -1) return i + spec.offset;
      }
      throw new Error('"' + tok + '" is not valid in the ' + label + ' field.');
    };
    const values = new Set();
    let star = false;
    text.split(',').forEach((part) => {
      if (part === '') throw new Error('The ' + label + ' field has an empty item.');
      const [range, stepText] = part.split('/');
      if (part.split('/').length > 2) throw new Error('The ' + label + ' field has more than one "/" in "' + part + '".');
      let step = 1;
      if (stepText !== undefined) {
        if (!/^\d+$/.test(stepText) || Number(stepText) < 1)
          throw new Error('The step in "' + part + '" must be a whole number above zero.');
        step = Number(stepText);
      }
      let lo;
      let hi;
      if (range === '*' || range === '?') {
        lo = spec.min;
        hi = spec.key === 'dow' ? 6 : spec.max;
        if (stepText === undefined) star = true;
      } else if (range.indexOf('-') !== -1) {
        const [a, b] = range.split('-');
        lo = toNum(a);
        hi = toNum(b);
        if (lo > hi) throw new Error('The range "' + range + '" in the ' + label + ' field runs backwards.');
      } else {
        lo = toNum(range);
        hi = stepText !== undefined ? spec.max : lo;
      }
      if (lo < spec.min || hi > spec.max)
        throw new Error('The ' + label + ' field must be between ' + spec.min + ' and ' + spec.max + ' (found "' + part + '").');
      for (let v = lo; v <= hi; v += step) values.add(spec.key === 'dow' && v === 7 ? 0 : v);
    });
    return { values: Array.from(values).sort((a, b) => a - b), star: star };
  }

  /** Parse an expression into { fields, raw, text }. */
  function parse(expr) {
    let text = String(expr === null || expr === undefined ? '' : expr)
      .trim()
      .replace(/\s+/g, ' ');
    if (!text) throw new Error('Type a cron expression, for example */15 9-17 * * 1-5.');
    const macro = MACROS[text.toLowerCase()];
    if (macro) text = macro;
    else if (text[0] === '@') throw new Error('"' + text + '" is not a known shortcut. Use @hourly, @daily, @weekly, @monthly or @yearly.');
    const parts = text.split(' ');
    if (parts.length === 6)
      throw new Error('This has six fields. Standard cron has five (no seconds). If the first field is seconds, remove it.');
    if (parts.length !== 5)
      throw new Error('A cron expression has five fields (minute hour day-of-month month day-of-week) but this has ' + parts.length + '.');
    const fields = {};
    SPEC.forEach((s, i) => (fields[s.key] = parseField(parts[i], s)));
    return { raw: parts.join(' '), parts: parts, fields: fields };
  }

  const hhmm = (h, m) => p2(h) + ':' + p2(m);
  const join = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const isContiguous = (v) => v.length > 2 && v[v.length - 1] - v[0] === v.length - 1;
  const stepOf = (v) => {
    if (v.length < 3) return null;
    const d = v[1] - v[0];
    return v.every((x, i) => i === 0 || x - v[i - 1] === d) ? d : null;
  };

  function timeText(f, parts) {
    const m = f.minute.values;
    const h = f.hour.values;
    const mAll = m.length === 60;
    const hAll = h.length === 24;
    if (mAll && hAll) return 'Every minute';
    if (m.length === 1 && h.length === 1) return 'At ' + hhmm(h[0], m[0]);
    if (m.length === 1 && h.length <= 6 && !hAll) return 'At ' + join(h.map((x) => hhmm(x, m[0])));
    const mStep = parts[0].indexOf('/') !== -1 && stepOf(m) ? stepOf(m) : null;
    let minutes;
    if (mAll) minutes = 'Every minute';
    else if (mStep && m[0] === 0 && m.length > 2) minutes = 'Every ' + mStep + ' minutes';
    else if (m.length === 1) minutes = 'At minute ' + m[0];
    else minutes = 'At minutes ' + join(m.map(String));
    if (hAll) return minutes === 'At minute ' + m[0] ? minutes + ' past every hour' : minutes;
    if (isContiguous(h)) return minutes + ' between ' + hhmm(h[0], 0) + ' and ' + hhmm(h[h.length - 1], 59);
    return minutes + ' past ' + (h.length === 1 ? 'hour ' + h[0] : 'hours ' + join(h.map(String)));
  }

  const ordinal = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  function dayText(f) {
    const dom = f.dom;
    const dow = f.dow;
    const domAll = dom.values.length === 31;
    const dowAll = dow.values.length === 7;
    const out = [];
    if (!dowAll) {
      const v = dow.values;
      out.push(
        v.length === 5 && v[0] === 1 && v[4] === 5
          ? 'on weekdays (Monday to Friday)'
          : v.length === 2 && v[0] === 0 && v[1] === 6
            ? 'on weekends (Saturday and Sunday)'
            : isContiguous(v)
              ? 'on ' + DAYS[v[0]] + ' to ' + DAYS[v[v.length - 1]]
              : 'on ' + join(v.map((x) => DAYS[x])),
      );
    }
    if (!domAll) {
      const v = dom.values;
      out.push(
        (v.length === 1
          ? 'on the ' + ordinal(v[0])
          : isContiguous(v)
            ? 'on the ' + ordinal(v[0]) + ' to the ' + ordinal(v[v.length - 1])
            : 'on the ' + join(v.map(ordinal))) + ' of the month',
      );
    }
    if (!domAll && !dowAll) return out.join(' or ') + ' (cron runs when either matches)';
    return out.length ? out[0] : 'every day';
  }

  function monthText(f) {
    const v = f.month.values;
    if (v.length === 12) return '';
    return 'in ' + (isContiguous(v) ? MONTHS[v[0] - 1] + ' to ' + MONTHS[v[v.length - 1] - 1] : join(v.map((x) => MONTHS[x - 1])));
  }

  /** Plain-English sentence for an expression. */
  function explain(expr) {
    const c = parse(expr);
    const f = c.fields;
    const parts = [timeText(f, c.parts), dayText(f), monthText(f)].filter(Boolean);
    const s = parts.join(', ');
    return s === 'Every minute, every day' ? 'Every minute' : s.replace(/, every day$/, '');
  }

  /** Notes about things that surprise people. */
  function warnings(expr) {
    const c = parse(expr);
    const f = c.fields;
    const w = [];
    if (f.dom.values.length !== 31 && f.dow.values.length !== 7)
      w.push('Both day-of-month and day-of-week are set: cron runs on days that match either one, not both.');
    if (f.dom.values.every((d) => d > 28) && f.month.values.length) {
      const short = f.month.values.filter((m) => [4, 6, 9, 11].indexOf(m) !== -1 && f.dom.values.every((d) => d === 31)).length;
      if (short || f.dom.values.every((d) => d === 31 || d === 30 || d === 29))
        w.push('Day ' + f.dom.values.join(', ') + ' does not exist in every month, so some months are skipped.');
    }
    if (f.minute.values.length === 60 && f.hour.values.length === 24)
      w.push('This runs every minute: make sure the job finishes in under a minute.');
    if (f.minute.values.length > 20 && f.hour.values.length > 12)
      w.push('This runs ' + f.minute.values.length * f.hour.values.length + ' times a day.');
    return w;
  }

  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  /**
   * Next `count` run times strictly after `from` ('YYYY-MM-DDTHH:MM' wall clock).
   * Returns wall-clock strings; empty when the schedule never runs within about eight years.
   */
  function next(expr, from, count) {
    const c = parse(expr);
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(from));
    if (!m) throw new Error('The start time must look like 2026-10-23T09:30.');
    const n = Math.min(Math.max(count || 5, 1), 50);
    const f = c.fields;
    const domR = f.dom.values.length !== 31;
    const dowR = f.dow.values.length !== 7;
    const out = [];
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);
    let startH = Number(m[4]);
    let startM = Number(m[5]) + 1;
    if (startM > 59) {
      startM = 0;
      startH++;
    }
    const limitYear = y + 8;
    let first = true;
    while (y <= limitYear && out.length < n) {
      const dim = daysIn(y, mo);
      if (f.month.values.indexOf(mo) !== -1 && d <= dim) {
        const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
        const okDom = f.dom.values.indexOf(d) !== -1;
        const okDow = f.dow.values.indexOf(wd) !== -1;
        const ok = domR && dowR ? okDom || okDow : okDom && okDow;
        if (ok) {
          for (const h of f.hour.values) {
            if (first && h < startH) continue;
            for (const mi of f.minute.values) {
              if (first && h === startH && mi < startM) continue;
              out.push(y + '-' + p2(mo) + '-' + p2(d) + 'T' + hhmm(h, mi));
              if (out.length >= n) return out;
            }
          }
        }
      }
      first = false;
      d++;
      if (d > dim) {
        d = 1;
        mo++;
        if (mo > 12) {
          mo = 1;
          y++;
        }
      }
      // Skip months that cannot match.
      while (y <= limitYear && f.month.values.indexOf(mo) === -1) {
        d = 1;
        mo++;
        if (mo > 12) {
          mo = 1;
          y++;
        }
      }
    }
    return out;
  }

  /** Wall-clock string -> same moment shifted by minutes, as a wall-clock string. */
  function shift(wall, minutes) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wall);
    if (!m) throw new Error('The time must look like 2026-10-23T09:30.');
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + minutes * 60000;
    return new Date(t).toISOString().slice(0, 16);
  }

  const PRESETS = [
    ['Every minute', '* * * * *'],
    ['Every 5 minutes', '*/5 * * * *'],
    ['Every 15 minutes during office hours, weekdays', '*/15 9-17 * * 1-5'],
    ['Every hour, on the hour', '0 * * * *'],
    ['Every day at 02:30', '30 2 * * *'],
    ['Weekdays at 09:00', '0 9 * * 1-5'],
    ['Every Monday at 08:30', '30 8 * * 1'],
    ['First day of every month at midnight', '0 0 1 * *'],
    ['Twice a day, 08:00 and 20:00', '0 8,20 * * *'],
    ['Quarterly: 1 Jan, Apr, Jul, Oct at 06:00', '0 6 1 1,4,7,10 *'],
  ];

  return { MONTHS: MONTHS, DAYS: DAYS, PRESETS: PRESETS, parse: parse, explain: explain, warnings: warnings, next: next, shift: shift };
});
