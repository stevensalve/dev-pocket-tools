/**
 * Diff Viewer - core logic (pure, no dependencies).
 * Myers' O(ND) line diff with a common prefix/suffix shortcut, word-level highlights and unified-diff output.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiffCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LINES = 20000;
  const MAX_EDITS = 3000;

  /** Split into lines (CRLF or LF); a trailing newline does not make an extra empty line. */
  function lines(text) {
    const t = String(text === null || text === undefined ? '' : text);
    if (t === '') return [];
    const parts = t.split(/\r\n|\n/);
    if (parts[parts.length - 1] === '') parts.pop();
    return parts;
  }

  const keyFn = (o) => (s) => {
    let k = s;
    if (o.ignoreWhitespace) k = k.replace(/\s+/g, ' ').trim();
    if (o.ignoreCase) k = k.toLowerCase();
    return k;
  };

  /** Myers shortest edit script on arrays of comparable keys. Returns [{ t: 'eq'|'del'|'add', i, j }] (indexes into a and b). */
  function myers(a, b) {
    const n = a.length;
    const m = b.length;
    const max = Math.min(n + m, MAX_EDITS);
    const off = max + 1;
    let v = new Int32Array(2 * max + 3);
    const trace = [];
    let found = -1;
    for (let d = 0; d <= max && found < 0; d++) {
      trace.push(v.slice());
      for (let k = -d; k <= d; k += 2) {
        let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) {
          x++;
          y++;
        }
        v[off + k] = x;
        if (x >= n && y >= m) {
          found = d;
          break;
        }
      }
    }
    if (found < 0) return null;
    const ops = [];
    let x = n;
    let y = m;
    for (let d = found; d > 0; d--) {
      const vv = trace[d];
      const k = x - y;
      const prevK = k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1]) ? k + 1 : k - 1;
      const prevX = vv[off + prevK];
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        x--;
        y--;
        ops.push({ t: 'eq', i: x, j: y });
      }
      if (x === prevX) {
        y--;
        ops.push({ t: 'add', i: x, j: y });
      } else {
        x--;
        ops.push({ t: 'del', i: x, j: y });
      }
    }
    while (x > 0 && y > 0) {
      x--;
      y--;
      ops.push({ t: 'eq', i: x, j: y });
    }
    return ops.reverse();
  }

  /**
   * Compare two texts. opts: { ignoreWhitespace, ignoreCase }.
   * Returns { rows: [{ type, a, b, text, other }], added, removed, same, similarity, notes }.
   * a and b are 1-based line numbers (null when the line is on one side only).
   */
  function diff(textA, textB, opts) {
    const o = opts || {};
    const A = lines(textA);
    const B = lines(textB);
    if (A.length > MAX_LINES || B.length > MAX_LINES)
      throw new Error('Each side can have up to ' + MAX_LINES.toLocaleString('en-US') + ' lines.');
    const key = keyFn(o);
    const ka = A.map(key);
    const kb = B.map(key);
    let pre = 0;
    while (pre < ka.length && pre < kb.length && ka[pre] === kb[pre]) pre++;
    let suf = 0;
    while (suf < ka.length - pre && suf < kb.length - pre && ka[ka.length - 1 - suf] === kb[kb.length - 1 - suf]) suf++;
    const midA = ka.slice(pre, ka.length - suf);
    const midB = kb.slice(pre, kb.length - suf);
    let mid = myers(midA, midB);
    const notes = [];
    if (mid === null) {
      notes.push('The two texts are very different, so every line of the changed section is shown as removed and added.');
      mid = midA.map((_, i) => ({ t: 'del', i: i, j: 0 })).concat(midB.map((_, j) => ({ t: 'add', i: midA.length, j: j })));
    }
    const rows = [];
    for (let i = 0; i < pre; i++) rows.push({ type: 'eq', a: i + 1, b: i + 1, text: A[i] });
    mid.forEach((op) => {
      if (op.t === 'eq') rows.push({ type: 'eq', a: pre + op.i + 1, b: pre + op.j + 1, text: A[pre + op.i] });
      else if (op.t === 'del') rows.push({ type: 'del', a: pre + op.i + 1, b: null, text: A[pre + op.i] });
      else rows.push({ type: 'add', a: null, b: pre + op.j + 1, text: B[pre + op.j] });
    });
    for (let s = 0; s < suf; s++)
      rows.push({ type: 'eq', a: A.length - suf + s + 1, b: B.length - suf + s + 1, text: A[A.length - suf + s] });
    const added = rows.filter((r) => r.type === 'add').length;
    const removed = rows.filter((r) => r.type === 'del').length;
    const same = rows.length - added - removed;
    if (/\r\n/.test(String(textA)) !== /\r\n/.test(String(textB)) && String(textA) && String(textB))
      notes.push('One text uses Windows line endings (CRLF) and the other does not. Line endings are ignored in this comparison.');
    return {
      rows: rows,
      added: added,
      removed: removed,
      same: same,
      similarity: A.length + B.length === 0 ? 1 : (2 * same) / (A.length + B.length),
      identical: added === 0 && removed === 0,
      notes: notes,
    };
  }

  /** Side-by-side rows: runs of removed and added lines are paired up. [{ left: {no,text}|null, right: {no,text}|null, type }] */
  function sideBySide(rows) {
    const out = [];
    let i = 0;
    while (i < rows.length) {
      if (rows[i].type === 'eq') {
        out.push({ type: 'eq', left: { no: rows[i].a, text: rows[i].text }, right: { no: rows[i].b, text: rows[i].text } });
        i++;
        continue;
      }
      const dels = [];
      const adds = [];
      while (i < rows.length && rows[i].type !== 'eq') {
        (rows[i].type === 'del' ? dels : adds).push(rows[i]);
        i++;
      }
      const n = Math.max(dels.length, adds.length);
      for (let k = 0; k < n; k++) {
        const l = dels[k];
        const r = adds[k];
        out.push({
          type: l && r ? 'change' : l ? 'del' : 'add',
          left: l ? { no: l.a, text: l.text } : null,
          right: r ? { no: r.b, text: r.text } : null,
        });
      }
    }
    return out;
  }

  const tokenize = (s) => s.match(/\s+|\w+|[^\w\s]/gu) || [];

  /** Word-level difference between two lines: { left: [{text, changed}], right: [...] }. */
  function words(a, b) {
    const ta = tokenize(a);
    const tb = tokenize(b);
    const ops = myers(ta, tb);
    if (ops === null) return { left: [{ text: a, changed: true }], right: [{ text: b, changed: true }] };
    const left = [];
    const right = [];
    const push = (arr, text, changed) => {
      if (arr.length && arr[arr.length - 1].changed === changed) arr[arr.length - 1].text += text;
      else arr.push({ text: text, changed: changed });
    };
    ops.forEach((op) => {
      if (op.t === 'eq') {
        push(left, ta[op.i], false);
        push(right, tb[op.j], false);
      } else if (op.t === 'del') push(left, ta[op.i], true);
      else push(right, tb[op.j], true);
    });
    return { left: left, right: right };
  }

  /** Standard unified diff text. */
  function unified(rows, nameA, nameB, context) {
    const ctx = context === undefined ? 3 : context;
    const changed = [];
    rows.forEach((r, i) => {
      if (r.type !== 'eq') changed.push(i);
    });
    if (!changed.length) return '';
    const hunks = [];
    changed.forEach((i) => {
      const lo = Math.max(0, i - ctx);
      const hi = Math.min(rows.length - 1, i + ctx);
      const last = hunks[hunks.length - 1];
      if (last && lo <= last.hi + 1) last.hi = hi;
      else hunks.push({ lo: lo, hi: hi });
    });
    const out = ['--- ' + (nameA || 'a'), '+++ ' + (nameB || 'b')];
    hunks.forEach((h) => {
      const slice = rows.slice(h.lo, h.hi + 1);
      const aRows = slice.filter((r) => r.type !== 'add');
      const bRows = slice.filter((r) => r.type !== 'del');
      const prevA = rows.slice(0, h.lo).filter((r) => r.type !== 'add').length;
      const prevB = rows.slice(0, h.lo).filter((r) => r.type !== 'del').length;
      const range = (n, prev) => (n === 0 ? prev : prev + 1) + (n === 1 ? '' : ',' + n);
      out.push('@@ -' + range(aRows.length, prevA) + ' +' + range(bRows.length, prevB) + ' @@');
      slice.forEach((r) => out.push((r.type === 'eq' ? ' ' : r.type === 'del' ? '-' : '+') + r.text));
    });
    return out.join('\n') + '\n';
  }

  function sample() {
    return {
      a: [
        'server:',
        '  port: 8080',
        '  host: localhost',
        '  timeout: 30',
        'logging:',
        '  level: info',
        'features:',
        '  - search',
        '  - export',
      ].join('\n'),
      b: [
        'server:',
        '  port: 9090',
        '  host: localhost',
        '  timeout: 30',
        '  tls: true',
        'logging:',
        '  level: debug',
        'features:',
        '  - search',
        '  - export',
        '  - audit',
      ].join('\n'),
    };
  }

  return { lines: lines, diff: diff, sideBySide: sideBySide, words: words, unified: unified, sample: sample };
});
