/**
 * Semver & Changelog helper - core logic (pure, no dependencies).
 * Versions follow semver.org 2.0.0; ranges follow the npm conventions (^, ~, x-ranges, hyphen, ||).
 * Commit lines follow Conventional Commits 1.0.0.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SemverCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ID = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
  const VER = new RegExp(
    '^[v=\\s]*(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(' +
      ID +
      '(?:\\.' +
      ID +
      ')*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?\\s*$',
  );
  const MAX = 9007199254740991;

  /** "v1.2.3-beta.1+b5" -> {major, minor, patch, pre:[...], build, text} or throws. */
  function parse(text) {
    const m = VER.exec(String(text === null || text === undefined ? '' : text));
    if (!m)
      throw new Error('"' + String(text).trim() + '" is not a valid version. Use MAJOR.MINOR.PATCH, for example 1.4.2 or 2.0.0-rc.1.');
    const n = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (n.some((x) => x > MAX)) throw new Error('A version number is too large.');
    const v = { major: n[0], minor: n[1], patch: n[2], pre: m[4] ? m[4].split('.') : [], build: m[5] || '' };
    v.text = format(v);
    return v;
  }

  function valid(text) {
    try {
      parse(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function format(v) {
    return v.major + '.' + v.minor + '.' + v.patch + (v.pre.length ? '-' + v.pre.join('.') : '') + (v.build ? '+' + v.build : '');
  }

  const isNum = (s) => /^\d+$/.test(s);

  /** -1, 0 or 1. Build metadata is ignored. */
  function compare(a, b) {
    const x = typeof a === 'string' ? parse(a) : a;
    const y = typeof b === 'string' ? parse(b) : b;
    for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
    if (!x.pre.length && !y.pre.length) return 0;
    if (!x.pre.length) return 1;
    if (!y.pre.length) return -1;
    for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
      const p = x.pre[i];
      const q = y.pre[i];
      if (p === undefined) return -1;
      if (q === undefined) return 1;
      if (p === q) continue;
      if (isNum(p) && isNum(q)) return Number(p) < Number(q) ? -1 : 1;
      if (isNum(p)) return -1;
      if (isNum(q)) return 1;
      return p < q ? -1 : 1;
    }
    return 0;
  }

  /** Sort version strings (invalid ones are returned separately). */
  function sort(list, descending) {
    const good = [];
    const bad = [];
    list.forEach((t) => (valid(t) ? good.push(parse(t)) : String(t).trim() && bad.push(String(t).trim())));
    good.sort((a, b) => compare(a, b) * (descending ? -1 : 1));
    return { sorted: good.map((v) => v.text), invalid: bad };
  }

  /** Which part changed between two versions. */
  function diff(a, b) {
    const x = parse(a);
    const y = parse(b);
    const c = compare(x, y);
    if (c === 0) return 'none';
    const [lo, hi] = c < 0 ? [x, y] : [y, x];
    if (lo.major !== hi.major) return 'major';
    if (lo.minor !== hi.minor) return 'minor';
    if (lo.patch !== hi.patch) return 'patch';
    return 'prerelease';
  }

  /** bump(version, 'major'|'minor'|'patch'|'premajor'|'preminor'|'prepatch'|'prerelease', preId) */
  function bump(text, type, preId) {
    const v = parse(text);
    const id = preId === undefined || preId === '' ? 'rc' : String(preId);
    if (!/^[0-9A-Za-z-]+$/.test(id)) throw new Error('The pre-release label may only contain letters, digits and hyphens.');
    const out = { major: v.major, minor: v.minor, patch: v.patch, pre: [], build: '' };
    const nextPre = () => {
      const last = v.pre[v.pre.length - 1];
      if (v.pre.length && v.pre[0] === id && isNum(String(last)) && v.pre.length === 2) return [id, String(Number(last) + 1)];
      return [id, '0'];
    };
    switch (type) {
      case 'major':
        if (!(v.minor === 0 && v.patch === 0 && v.pre.length)) out.major++;
        out.minor = 0;
        out.patch = 0;
        break;
      case 'minor':
        if (!(v.patch === 0 && v.pre.length)) out.minor++;
        out.patch = 0;
        break;
      case 'patch':
        if (!v.pre.length) out.patch++;
        break;
      case 'premajor':
        out.major++;
        out.minor = 0;
        out.patch = 0;
        out.pre = [id, '0'];
        break;
      case 'preminor':
        out.minor++;
        out.patch = 0;
        out.pre = [id, '0'];
        break;
      case 'prepatch':
        out.patch++;
        out.pre = [id, '0'];
        break;
      case 'prerelease':
        if (v.pre.length) out.pre = nextPre();
        else {
          out.patch++;
          out.pre = [id, '0'];
        }
        break;
      default:
        throw new Error('Unknown bump type "' + type + '".');
    }
    return format(out);
  }

  // ---- ranges -------------------------------------------------------------

  const XR = '(\\d+|[xX*])';
  const PARTIAL = new RegExp('^[v=]*' + XR + '(?:\\.' + XR + '(?:\\.' + XR + '(?:-([0-9A-Za-z.-]+))?(?:\\+[0-9A-Za-z.-]+)?)?)?$');

  function partial(s) {
    const m = PARTIAL.exec(s);
    if (!m) throw new Error('"' + s + '" is not a valid version range.');
    const n = (x) => (x === undefined || /^[xX*]$/.test(x) ? null : Number(x));
    return { major: n(m[1]), minor: n(m[2]), patch: n(m[3]), pre: m[4] ? m[4].split('.') : [] };
  }

  const mk = (major, minor, patch, pre) => ({ major: major, minor: minor, patch: patch, pre: pre || [], build: '' });
  const lt = (op, v) => ({ op: op, v: v });

  function expand(op, s) {
    const p = partial(s);
    if (p.major === null) return op === '<' || op === '>' ? [lt('<', mk(0, 0, 0))] : [];
    const M = p.major;
    const mi = p.minor;
    const pa = p.patch;
    if (op === '^') {
      const low = mk(M, mi === null ? 0 : mi, pa === null ? 0 : pa, p.pre);
      let hi;
      if (M > 0 || mi === null) hi = mk(M + 1, 0, 0);
      else if (mi > 0 || pa === null) hi = mk(0, mi + 1, 0);
      else hi = mk(0, 0, pa + 1);
      return [lt('>=', low), lt('<', hi)];
    }
    if (op === '~') {
      const low = mk(M, mi === null ? 0 : mi, pa === null ? 0 : pa, p.pre);
      return [lt('>=', low), lt('<', mi === null ? mk(M + 1, 0, 0) : mk(M, mi + 1, 0))];
    }
    if (mi === null || pa === null) {
      const low = mk(M, mi === null ? 0 : mi, 0);
      const hi = mi === null ? mk(M + 1, 0, 0) : mk(M, mi + 1, 0);
      if (op === '' || op === '=') return [lt('>=', low), lt('<', hi)];
      if (op === '>') return [lt('>=', hi)];
      if (op === '>=') return [lt('>=', low)];
      if (op === '<') return [lt('<', low)];
      if (op === '<=') return [lt('<', hi)];
    }
    const v = mk(M, mi, pa, p.pre);
    return [lt(op === '' ? '=' : op, v)];
  }

  /** "^1.2.3 || >=2 <3" -> array of comparator sets. */
  function parseRange(text) {
    const src = String(text === null || text === undefined ? '' : text).trim();
    if (src.length > 500) throw new Error('That range is too long.');
    const sets = src.split('||').map((part) => {
      let s = part.trim();
      if (!s) return [];
      const h = /^(\S+)\s+-\s+(\S+)$/.exec(s);
      if (h) {
        const a = partial(h[1]);
        const b = partial(h[2]);
        const out = [];
        if (a.major !== null) out.push(lt('>=', mk(a.major, a.minor === null ? 0 : a.minor, a.patch === null ? 0 : a.patch, a.pre)));
        if (b.major !== null) {
          if (b.minor === null) out.push(lt('<', mk(b.major + 1, 0, 0)));
          else if (b.patch === null) out.push(lt('<', mk(b.major, b.minor + 1, 0)));
          else out.push(lt('<=', mk(b.major, b.minor, b.patch, b.pre)));
        }
        return out;
      }
      s = s.replace(/(\^|~>?|[<>]=?|=)\s+/g, '$1');
      const out = [];
      s.split(/\s+/).forEach((tok) => {
        const m = /^(\^|~>?|>=|<=|>|<|=)?(.*)$/.exec(tok);
        expand(m[1] === '~>' ? '~' : m[1] || '', m[2]).forEach((c) => out.push(c));
      });
      return out;
    });
    return sets;
  }

  function test(v, c) {
    const r = compare(v, c.v);
    return c.op === '>' ? r > 0 : c.op === '>=' ? r >= 0 : c.op === '<' ? r < 0 : c.op === '<=' ? r <= 0 : r === 0;
  }

  /** Does the version satisfy the range? Pre-releases only match when the range names the same x.y.z with a pre-release tag. */
  function satisfies(version, range) {
    const v = parse(version);
    return parseRange(range).some((set) => {
      if (!set.every((c) => test(v, c))) return false;
      if (!v.pre.length) return true;
      return set.some((c) => c.v.pre.length && c.v.major === v.major && c.v.minor === v.minor && c.v.patch === v.patch);
    });
  }

  /** Check a list of versions against a range. */
  function filter(list, range) {
    const rows = [];
    list.forEach((t) => {
      const s = String(t).trim();
      if (!s) return;
      rows.push(valid(s) ? { version: parse(s).text, ok: satisfies(s, range) } : { version: s, ok: false, invalid: true });
    });
    const good = rows.filter((r) => r.ok).map((r) => r.version);
    good.sort(compare);
    return { rows: rows, highest: good.length ? good[good.length - 1] : null };
  }

  function explainRange(range) {
    const sets = parseRange(range);
    const sym = { '>': 'above ', '>=': 'at least ', '<': 'below ', '<=': 'at most ', '=': 'exactly ' };
    if (sets.every((s) => !s.length)) return 'Any version (a pre-release is only matched if you name it).';
    return sets.map((s) => (s.length ? s.map((c) => sym[c.op] + format(c.v)).join(' and ') : 'any version')).join(', or ');
  }

  // ---- conventional commits ------------------------------------------------

  const TYPES = [
    { id: 'feat', title: 'Features' },
    { id: 'fix', title: 'Bug fixes' },
    { id: 'perf', title: 'Performance' },
    { id: 'revert', title: 'Reverts' },
    { id: 'refactor', title: 'Refactoring' },
    { id: 'docs', title: 'Documentation' },
    { id: 'build', title: 'Build system' },
    { id: 'ci', title: 'CI' },
    { id: 'test', title: 'Tests' },
    { id: 'style', title: 'Style' },
    { id: 'chore', title: 'Chores' },
  ];
  const SHOWN = ['feat', 'fix', 'perf', 'revert'];
  const HEADER = /^(?:[0-9a-f]{7,40}\s+|[-*]\s+)?(\w+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;

  /** One line -> {type, scope, breaking, subject, hash, issues} or null when it is not a conventional commit. */
  function parseCommit(line) {
    let l = String(line).trim();
    if (!l) return null;
    const h = /^([0-9a-f]{7,40})\s+(.*)$/.exec(l);
    const hash = h ? h[1].slice(0, 7) : '';
    const m = HEADER.exec(l);
    if (!m) return null;
    const type = m[1].toLowerCase();
    if (!TYPES.some((t) => t.id === type)) return null;
    let subject = m[4].trim();
    let breaking = Boolean(m[3]);
    if (/\bBREAKING[ -]CHANGE\b/.test(subject)) {
      breaking = true;
      subject = subject.replace(/\s*BREAKING[ -]CHANGE:?\s*/, ' ').trim();
    }
    const issues = [];
    subject.replace(/#(\d+)/g, (x, n) => issues.push(n));
    return { type: type, scope: m[2] ? m[2].trim() : '', breaking: breaking, subject: subject, hash: hash, issues: issues };
  }

  /** Lines of git log (one per commit, optionally "abc1234 feat: ...") -> release data. */
  function release(text, opts) {
    const o = opts || {};
    const cur = parse(o.current || '0.0.0');
    const src = String(text === null || text === undefined ? '' : text);
    if (src.length > 2000000) throw new Error('That list is too long.');
    const lines = src.split('\n').filter((l) => l.trim());
    if (!lines.length) throw new Error('Paste one commit message per line, for example "feat(api): add search endpoint".');
    const commits = [];
    const other = [];
    lines.forEach((l) => {
      const c = parseCommit(l);
      if (c) commits.push(c);
      else other.push(l.trim());
    });
    if (!commits.length)
      throw new Error(
        'None of the ' +
          lines.length +
          ' line(s) look like conventional commits ("type(scope): subject"). Types: ' +
          TYPES.map((t) => t.id).join(', ') +
          '.',
      );
    const breaking = commits.filter((c) => c.breaking);
    const feats = commits.filter((c) => c.type === 'feat');
    const fixes = commits.filter((c) => c.type === 'fix' || c.type === 'perf');
    const level = breaking.length ? 'major' : feats.length ? 'minor' : fixes.length ? 'patch' : 'none';
    // Before 1.0.0, breaking changes move the minor number by convention.
    let next;
    if (level === 'none') next = cur.text;
    else if (cur.major === 0 && level === 'major') next = bump(cur.text, 'minor');
    else next = bump(cur.text, level);
    const groups = TYPES.map((t) => ({
      id: t.id,
      title: t.title,
      shown: SHOWN.indexOf(t.id) !== -1 || o.all === true,
      items: commits.filter((c) => c.type === t.id),
    })).filter((g) => g.items.length);
    return {
      current: cur.text,
      next: next,
      level: level,
      zeroMajor: cur.major === 0,
      counts: { total: commits.length, breaking: breaking.length, feat: feats.length, fix: fixes.length },
      groups: groups,
      breaking: breaking,
      skipped: other,
    };
  }

  /** Markdown release notes. opts: {version, date, repoUrl} - date as given (YYYY-MM-DD). */
  function markdown(rel, opts) {
    const o = opts || {};
    const L = ['## ' + (o.version || rel.next) + (o.date ? ' (' + o.date + ')' : ''), ''];
    const item = (c) => '- ' + (c.scope ? '**' + c.scope + ':** ' : '') + c.subject + (c.hash ? ' (' + c.hash + ')' : '');
    if (rel.breaking.length) {
      L.push('### BREAKING CHANGES', '');
      rel.breaking.forEach((c) => L.push(item(c)));
      L.push('');
    }
    rel.groups
      .filter((g) => g.shown)
      .forEach((g) => {
        L.push('### ' + g.title, '');
        g.items.forEach((c) => L.push(item(c)));
        L.push('');
      });
    if (L.length === 2) L.push('No user-facing changes.', '');
    return L.join('\n').replace(/\n+$/, '\n');
  }

  function sample() {
    return [
      'feat(api): add order search endpoint (#412)',
      'fix(auth): refresh token expiry was off by one hour #431',
      'fix: handle empty cart on checkout',
      'perf(db): add index on orders.created_at',
      'docs: update deployment guide',
      'chore(deps): bump express to 4.21',
      'refactor(core)!: drop support for Node 16',
      'ci: cache npm in the pipeline',
      'Merge branch main into release',
    ].join('\n');
  }

  return {
    parse: parse,
    valid: valid,
    format: format,
    compare: compare,
    sort: sort,
    diff: diff,
    bump: bump,
    parseRange: parseRange,
    satisfies: satisfies,
    filter: filter,
    explainRange: explainRange,
    TYPES: TYPES,
    parseCommit: parseCommit,
    release: release,
    markdown: markdown,
    sample: sample,
  };
});
