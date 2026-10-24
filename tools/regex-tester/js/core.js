/**
 * Regex Tester - core logic (pure, JavaScript regular expressions).
 * A JavaScript regex cannot be interrupted once it starts, so the tool limits input size
 * and match count and warns about patterns that are known to backtrack badly.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RegexCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FLAGS = [
    ['g', 'global', 'find every match, not just the first'],
    ['i', 'ignore case', 'A matches a'],
    ['m', 'multiline', '^ and $ match at each line'],
    ['s', 'dot matches newline', '. also matches line breaks'],
    ['u', 'unicode', 'treat the pattern as Unicode'],
    ['y', 'sticky', 'match only at the current position'],
  ];
  const MAX_TEXT = 200000;
  const MAX_MATCHES = 1000;

  function checkFlags(flags) {
    const f = String(flags || '');
    for (const c of f) if ('dgimsuvy'.indexOf(c) === -1) throw new Error('"' + c + '" is not a regex flag.');
    if (new Set(f).size !== f.length) throw new Error('A flag is repeated.');
    return f;
  }

  /** Build the RegExp or throw an Error with the engine's reason. */
  function compile(pattern, flags) {
    const f = checkFlags(flags);
    if (pattern === '' || pattern === undefined || pattern === null) throw new Error('Type a pattern first.');
    try {
      return new RegExp(pattern, f);
    } catch (e) {
      throw new Error(
        String(e.message)
          .replace(/^Invalid regular expression: /, '')
          .replace(/^\/.*\/[a-z]*: /, ''),
      );
    }
  }

  const lineCol = (text, i) => {
    const before = text.slice(0, i).split('\n');
    return { line: before.length, col: before[before.length - 1].length + 1 };
  };

  /** Patterns that are known to take exponential time on some inputs. Heuristic, not a proof. */
  function warnings(pattern) {
    const w = [];
    const p = String(pattern || '');
    if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(p))
      w.push(
        'A group that already repeats is repeated again (like (a+)+). On some inputs this can freeze the page: rewrite it or test with short text.',
      );
    if (/\(([^()|]+)\|\1\)[+*]/.test(p))
      w.push('Repeated alternatives that overlap (like (a|a)*) can run for a very long time on some inputs.');
    if (/(\.\*|\.\+)[^)]*\1/.test(p) && /[*+]\s*$|\.\*.*\.\*/.test(p))
      w.push('Several .* in one pattern can be slow on long text that does not match.');
    return w;
  }

  /**
   * Run a pattern over text. Returns { matches, truncated, warnings, canBeEmpty }.
   * match = { index, end, text, line, col, groups: [{ name, index, text }] }
   */
  function run(pattern, flags, text) {
    const f = checkFlags(flags);
    const src = String(text === null || text === undefined ? '' : text);
    if (src.length > MAX_TEXT)
      throw new Error('The text is over ' + MAX_TEXT.toLocaleString('en-US') + ' characters: test with a smaller sample.');
    const re = compile(pattern, f.indexOf('d') === -1 ? f + 'd' : f);
    const global = f.indexOf('g') !== -1 || f.indexOf('y') !== -1;
    const matches = [];
    let truncated = false;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const names = m.groups ? Object.keys(m.groups) : [];
      const groups = [];
      for (let g = 1; g < m.length; g++) {
        let name = null;
        if (names.length) name = names.find((n) => m.groups[n] === m[g] && !groups.some((x) => x.name === n)) || null;
        const idx = m.indices ? (m.indices[g] ? m.indices[g][0] : -1) : -1;
        groups.push({ name: name, index: idx, text: m[g] === undefined ? null : m[g] });
      }
      const lc = lineCol(src, m.index);
      matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], line: lc.line, col: lc.col, groups: groups });
      if (!global) break;
      if (matches.length >= MAX_MATCHES) {
        truncated = true;
        break;
      }
      if (m[0] === '') re.lastIndex++;
    }
    return {
      matches: matches,
      truncated: truncated,
      warnings: warnings(pattern),
      canBeEmpty: new RegExp('^(?:' + pattern + ')$', f.replace(/[gy]/g, '')).test(''),
    };
  }

  /** Split text into pieces for highlighting: [{ text, match: index | null }]. */
  function segments(text, matches) {
    const out = [];
    let pos = 0;
    matches.forEach((m, i) => {
      if (m.end === m.index) return;
      if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null });
      out.push({ text: text.slice(m.index, m.end), match: i });
      pos = m.end;
    });
    if (pos < text.length) out.push({ text: text.slice(pos), match: null });
    return out;
  }

  /** Replace using JavaScript replacement syntax ($1, $&, $<name>). */
  function replace(pattern, flags, text, replacement) {
    const re = compile(pattern, flags);
    if (String(text).length > MAX_TEXT) throw new Error('The text is too long to test.');
    return String(text).replace(re, String(replacement === undefined ? '' : replacement));
  }

  const ESC = {
    d: 'a digit (0-9)',
    D: 'anything except a digit',
    w: 'a letter, digit or underscore',
    W: 'anything except a letter, digit or underscore',
    s: 'a space, tab or line break',
    S: 'anything except whitespace',
    b: 'a word boundary',
    B: 'not a word boundary',
    n: 'a line break',
    t: 'a tab',
    r: 'a carriage return',
  };

  function quant(s, i) {
    const c = s[i];
    let q = null;
    let len = 1;
    if (c === '*') q = 'zero or more times';
    else if (c === '+') q = 'one or more times';
    else if (c === '?') q = 'optional (zero or one time)';
    else if (c === '{') {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(s.slice(i));
      if (!m) return null;
      len = m[0].length;
      q = m[2] ? (m[3] === '' ? m[1] + ' or more times' : 'between ' + m[1] + ' and ' + m[3] + ' times') : 'exactly ' + m[1] + ' times';
    } else return null;
    let lazy = false;
    if (s[i + len] === '?' && c !== '?') {
      lazy = true;
      len++;
    }
    return { text: s.slice(i, i + len), meaning: q + (lazy ? ', as few as possible' : ''), len: len };
  }

  /** Token-by-token plain-English explanation. Returns [{ token, meaning, depth }]. */
  function explain(pattern) {
    const s = String(pattern || '');
    const out = [];
    let depth = 0;
    let i = 0;
    const add = (token, meaning, d) => out.push({ token: token, meaning: meaning, depth: d === undefined ? depth : d });
    while (i < s.length) {
      const c = s[i];
      let q;
      if (c === '\\') {
        const n = s[i + 1];
        let t = s.slice(i, i + 2);
        let meaning;
        if (n === undefined) meaning = 'a stray backslash';
        else if (ESC[n]) meaning = ESC[n];
        else if (/\d/.test(n)) meaning = 'what capture group ' + n + ' matched';
        else if (n === 'k') {
          const m = /^\\k<([^>]+)>/.exec(s.slice(i));
          if (m) {
            t = m[0];
            meaning = 'what the group named ' + m[1] + ' matched';
          } else meaning = 'the letter k';
        } else if (n === 'u' || n === 'x') {
          const m = new RegExp('^\\\\' + n + (n === 'u' ? '(?:\\{[0-9a-fA-F]+\\}|[0-9a-fA-F]{4})' : '[0-9a-fA-F]{2}')).exec(s.slice(i));
          if (m) {
            t = m[0];
            meaning = 'the character with code ' + m[0].slice(2).replace(/[{}]/g, '');
          } else meaning = 'the letter ' + n;
        } else if (n === 'p' || n === 'P') {
          const m = /^\\[pP]\{[^}]*\}/.exec(s.slice(i));
          if (m) {
            t = m[0];
            meaning = (n === 'P' ? 'not ' : '') + 'a Unicode property: ' + m[0].slice(3, -1);
          } else meaning = 'the letter ' + n;
        } else meaning = 'the character ' + n + ' (escaped)';
        add(t, meaning);
        i += t.length;
      } else if (c === '[') {
        let j = i + 1;
        if (s[j] === '^') j++;
        if (s[j] === ']') j++;
        while (j < s.length && s[j] !== ']') j += s[j] === '\\' ? 2 : 1;
        const t = s.slice(i, j + 1);
        add(t, (t[1] === '^' ? 'any one character except ' : 'any one of ') + describeClass(t.slice(t[1] === '^' ? 2 : 1, -1)));
        i = j + 1;
      } else if (c === '(') {
        let m;
        if ((m = /^\(\?<([A-Za-z_]\w*)>/.exec(s.slice(i)))) {
          add(m[0], 'start of a capture group named ' + m[1]);
          depth++;
          i += m[0].length;
        } else if (s.startsWith('(?:', i)) {
          add('(?:', 'start of a group that does not capture');
          depth++;
          i += 3;
        } else if (s.startsWith('(?=', i)) {
          add('(?=', 'followed by (looks ahead without using the text)');
          depth++;
          i += 3;
        } else if (s.startsWith('(?!', i)) {
          add('(?!', 'not followed by');
          depth++;
          i += 3;
        } else if (s.startsWith('(?<=', i)) {
          add('(?<=', 'preceded by (looks behind)');
          depth++;
          i += 4;
        } else if (s.startsWith('(?<!', i)) {
          add('(?<!', 'not preceded by');
          depth++;
          i += 4;
        } else {
          add('(', 'start of a capture group');
          depth++;
          i++;
        }
      } else if (c === ')') {
        depth = Math.max(0, depth - 1);
        add(')', 'end of the group');
        i++;
      } else if ((q = quant(s, i))) {
        add(q.text, q.meaning);
        i += q.len;
      } else {
        if (c === '^') add('^', 'start of the text (or of a line with the m flag)');
        else if (c === '$') add('$', 'end of the text (or of a line with the m flag)');
        else if (c === '.') add('.', 'any character except a line break');
        else if (c === '|') add('|', 'or');
        else add(c, 'the character ' + (c === ' ' ? 'space' : c));
        i++;
      }
    }
    return out;
  }

  function describeClass(body) {
    const parts = [];
    let i = 0;
    while (i < body.length) {
      if (body[i] === '\\' && body[i + 1]) {
        parts.push(ESC[body[i + 1]] && 'dDwWsS'.indexOf(body[i + 1]) !== -1 ? ESC[body[i + 1]] : body[i + 1]);
        i += 2;
      } else if (body[i + 1] === '-' && body[i + 2] !== undefined) {
        parts.push(body[i] + ' to ' + body[i + 2]);
        i += 3;
      } else {
        parts.push(body[i] === ' ' ? 'space' : body[i]);
        i++;
      }
    }
    return parts.join(', ');
  }

  const SNIPPETS = [
    {
      name: 'Indian mobile number',
      pattern: '^(?:\\+91[\\s-]?|0)?[6-9]\\d{9}$',
      flags: '',
      yes: ['9876543210', '+91 98765 43210'.replace(' 98765 ', '98765'), '09876543210'],
      no: ['1234567890', '98765'],
    },
    { name: 'PAN', pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', flags: '', yes: ['ABCDE1234F'], no: ['abcde1234f', 'ABCD12345F'] },
    {
      name: 'GSTIN (format only)',
      pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
      flags: '',
      yes: ['27ABCDE1234F1Z5'],
      no: ['27ABCDE1234F1X5'],
    },
    { name: 'PIN code', pattern: '^[1-9]\\d{5}$', flags: '', yes: ['560001'], no: ['060001', '5600'] },
    { name: 'IFSC code', pattern: '^[A-Z]{4}0[A-Z0-9]{6}$', flags: '', yes: ['HDFC0001234'], no: ['HDFC1001234'] },
    {
      name: 'Email (simple)',
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      flags: '',
      yes: ['asha@example.com'],
      no: ['asha@example', 'a b@x.com'],
    },
    {
      name: 'Date DD/MM/YYYY',
      pattern: '^(0[1-9]|[12]\\d|3[01])/(0[1-9]|1[0-2])/\\d{4}$',
      flags: '',
      yes: ['23/10/2026'],
      no: ['32/10/2026', '2026-10-23'],
    },
    {
      name: 'IPv4 address',
      pattern: '^(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)$',
      flags: '',
      yes: ['192.168.1.10', '255.255.255.255'],
      no: ['256.1.1.1', '1.2.3'],
    },
    {
      name: 'UUID',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      flags: 'i',
      yes: ['123e4567-e89b-12d3-a456-426614174000'],
      no: ['123e4567e89b12d3a456426614174000'],
    },
    {
      name: 'Semantic version',
      pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$',
      flags: '',
      yes: ['1.4.2', '2.0.0-rc.1+build.5'],
      no: ['1.4', '01.2.3'],
    },
    { name: 'Hex colour', pattern: '^#(?:[0-9a-fA-F]{3}){1,2}$', flags: '', yes: ['#fff', '#1a2B3c'], no: ['#ffff', 'fff'] },
    {
      name: 'URL (http or https)',
      pattern: '^https?://[^\\s/$.?#].[^\\s]*$',
      flags: 'i',
      yes: ['https://example.com/a?b=1'],
      no: ['ftp://x.com', 'example.com'],
    },
  ];

  function sample() {
    return {
      pattern: '(?<user>[\\w.]+)@(?<host>[\\w.-]+\\.\\w+)',
      flags: 'g',
      text: 'Contact asha.k@example.com or ravi@mail.example.org.\nNot an address: nobody@localhost',
    };
  }

  return {
    FLAGS: FLAGS,
    MAX_TEXT: MAX_TEXT,
    MAX_MATCHES: MAX_MATCHES,
    compile: compile,
    warnings: warnings,
    run: run,
    segments: segments,
    replace: replace,
    explain: explain,
    SNIPPETS: SNIPPETS,
    sample: sample,
  };
});
