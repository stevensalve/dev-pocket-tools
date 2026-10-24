/* Semver & Changelog Helper - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText, downloadBlob } = OT;
  const $ = (id) => document.getElementById(id);
  let notes = '';

  const head = (cols) =>
    el('thead', {}, [
      el(
        'tr',
        {},
        cols.map((h) => el('th', { scope: 'col', text: h })),
      ),
    ]);

  function bumps() {
    const t = $('t-bump');
    t.textContent = '';
    try {
      const v = SemverCore.parse($('cur').value);
      const kinds = ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease'];
      t.appendChild(head(['Bump', 'Result', '']));
      const b = el('tbody');
      kinds.forEach((k) => {
        const r = SemverCore.bump(v.text, k, $('pre').value);
        const btn = el('button', { type: 'button', text: 'Copy', 'aria-label': 'Copy ' + r });
        btn.addEventListener('click', async () => {
          const ok = await copyText(r);
          setStatus($('bstatus'), ok === false ? 'Could not copy.' : r + ' copied.', ok === false ? 'warn' : 'ok');
        });
        b.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { class: 'mono', text: r }), el('td', {}, [btn])]));
      });
      t.appendChild(b);
      setStatus($('bstatus'), v.build ? 'Build metadata (+' + v.build + ') is dropped when bumping.' : '', v.build ? 'warn' : '');
    } catch (e) {
      setStatus($('bstatus'), e.message, 'error');
    }
  }

  function range() {
    const t = $('t-range');
    t.textContent = '';
    const list = $('vers').value.split('\n');
    try {
      const expl = SemverCore.explainRange($('range').value);
      const r = SemverCore.filter(list, $('range').value);
      t.appendChild(head(['Version', 'Matches']));
      const b = el('tbody');
      r.rows.forEach((x) =>
        b.appendChild(
          el('tr', {}, [
            el('td', { class: 'mono', text: x.version }),
            el('td', {}, [
              el('span', {
                class: 'pill ' + (x.invalid ? 'overdue' : x.ok ? 'done' : 'upcoming'),
                text: x.invalid ? 'not a version' : x.ok ? 'yes' : 'no',
              }),
            ]),
          ]),
        ),
      );
      t.appendChild(b);
      setStatus($('rstatus'), 'Means: ' + expl + '. ' + (r.highest ? 'Highest match: ' + r.highest + '.' : 'No version matches.'), 'ok');
    } catch (e) {
      setStatus($('rstatus'), e.message, 'error');
    }
  }

  function draft() {
    $('cstats').textContent = '';
    $('md').textContent = '';
    notes = '';
    try {
      const cur = SemverCore.parse($('cur').value).text;
      const r = SemverCore.release($('log').value, { current: cur, all: $('rall').checked });
      notes = SemverCore.markdown(r, { date: $('rdate').value.trim() });
      $('md').textContent = notes;
      [
        ['suggested next', r.next],
        ['change level', r.level],
        ['commits', r.counts.total],
        ['features', r.counts.feat],
        ['fixes', r.counts.fix],
        ['breaking', r.counts.breaking],
      ].forEach((p) =>
        $('cstats').appendChild(
          el('div', { class: 'stat' + (p[0] === 'breaking' && p[1] ? ' bad' : '') }, [
            el('b', { text: String(p[1]) }),
            el('span', { text: p[0] }),
          ]),
        ),
      );
      setStatus(
        $('cstatus'),
        r.skipped.length
          ? r.skipped.length + ' line(s) skipped: ' + r.skipped.slice(0, 3).join(' | ') + (r.skipped.length > 3 ? ' ...' : '')
          : 'All lines understood.',
        r.skipped.length ? 'warn' : 'ok',
      );
    } catch (e) {
      setStatus($('cstatus'), e.message, 'error');
    }
  }

  $('cur').addEventListener('input', bumps);
  $('pre').addEventListener('input', bumps);
  $('range').addEventListener('input', range);
  $('vers').addEventListener('input', range);
  $('sort').addEventListener('click', () => {
    const r = SemverCore.sort($('vers').value.split('\n'), true);
    $('vers').value = r.sorted.concat(r.invalid).join('\n');
    range();
  });
  $('mk').addEventListener('click', draft);
  $('sample').addEventListener('click', () => {
    $('log').value = SemverCore.sample();
    draft();
  });
  $('cmd').addEventListener('click', async () => {
    if (!notes) return setStatus($('cstatus'), 'Draft the release notes first.', 'warn');
    const ok = await copyText(notes);
    setStatus($('cstatus'), ok === false ? 'Could not copy.' : 'Markdown copied.', ok === false ? 'warn' : 'ok');
  });
  $('dl').addEventListener('click', () => {
    if (!notes) return setStatus($('cstatus'), 'Draft the release notes first.', 'warn');
    downloadBlob(new Blob([notes], { type: 'text/markdown;charset=utf-8' }), 'release-notes.md');
  });
  bumps();
  range();
})();
