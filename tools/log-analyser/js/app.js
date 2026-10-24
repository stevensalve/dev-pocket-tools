/* Log Analyser - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText, readText, bindDropzone, downloadBlob } = OT;
  const $ = (id) => document.getElementById(id);
  const MAX_FILE = 20 * 1024 * 1024;
  const SHOW = 300;
  let entries = [];
  let summary = null;
  let levels = [];
  let matches = [];

  const when = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  const head = (cols) =>
    el('thead', {}, [
      el(
        'tr',
        {},
        cols.map((h) => el('th', { scope: 'col', text: h })),
      ),
    ]);

  function stat(label, value, bad) {
    return el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(value) }), el('span', { text: label })]);
  }

  function analyse() {
    let r;
    try {
      r = LogCore.parse($('text').value);
      if (!r.entries.length)
        throw new Error('No log entries were recognised. Paste lines that start with a date and a level, or JSON lines.');
      summary = LogCore.analyse(r.entries);
    } catch (e) {
      $('sum').hidden = true;
      $('flt').hidden = true;
      return setStatus($('status'), e.message, 'error');
    }
    entries = r.entries;
    const notes = [];
    if (r.truncated) notes.push('Only the first 300,000 lines were read.');
    if (r.unparsed) notes.push(r.unparsed + ' line(s) before the first entry were skipped.');
    setStatus($('status'), r.entries.length + ' entries read.' + (notes.length ? ' ' + notes.join(' ') : ''), notes.length ? 'warn' : 'ok');
    render();
  }

  function render() {
    const s = summary;
    $('sum').hidden = false;
    $('flt').hidden = false;
    const st = $('stats');
    st.textContent = '';
    st.appendChild(stat('entries', s.total));
    st.appendChild(stat('errors + fatal', s.levels.ERROR + s.levels.FATAL, s.levels.ERROR + s.levels.FATAL > 0));
    st.appendChild(stat('warnings', s.levels.WARN));
    st.appendChild(stat('error rate', (s.errorRate * 100).toFixed(1) + '%'));
    if (s.first !== null) st.appendChild(stat('time range (as written)', when(s.first) + ' to ' + when(s.last)));
    if (s.busiest) st.appendChild(stat('busiest ' + s.unit, when(s.busiest.time) + ' (' + s.busiest.total + ')'));

    $('unit').textContent = s.unit;
    const t = $('t-time');
    t.textContent = '';
    const max = Math.max.apply(null, s.timeline.map((b) => b.total).concat([1]));
    if (s.timeline.length) {
      t.appendChild(head(['When', 'Entries', 'Errors', '']));
      const b = el('tbody');
      s.timeline.slice(0, 120).forEach((x) => {
        const bar = el('span');
        bar.style.width = Math.round((x.total / max) * 100) + '%';
        b.appendChild(
          el('tr', {}, [
            el('td', { class: 'mono', text: when(x.time) }),
            el('td', { text: String(x.total) }),
            el('td', { text: String(x.errors) }),
            el('td', {}, [el('div', { class: 'hbar' + (x.errors ? ' err' : '') }, [bar])]),
          ]),
        );
      });
      t.appendChild(b);
    } else t.appendChild(el('caption', { text: 'No timestamps were found in these lines.' }));

    const p = $('t-prob');
    p.textContent = '';
    if (s.topProblems.length) {
      p.appendChild(head(['Count', 'Level', 'Problem', 'First seen', 'Last seen']));
      const b = el('tbody');
      s.topProblems.forEach((g) =>
        b.appendChild(
          el('tr', {}, [
            el('td', { text: String(g.count) }),
            el('td', {}, [el('span', { class: 'pill ' + g.level, text: g.level })]),
            el('td', { class: 'mono', text: g.pattern + (g.hasTrace ? '  (has stack trace)' : '') }),
            el('td', { class: 'mono', text: g.first === null ? '' : when(g.first) }),
            el('td', { class: 'mono', text: g.last === null ? '' : when(g.last) }),
          ]),
        ),
      );
      p.appendChild(b);
    } else p.appendChild(el('caption', { text: 'No warnings or errors found.' }));

    const a = s.access;
    $('acc').hidden = !a;
    if (a) {
      const t2 = $('t-acc');
      t2.textContent = '';
      t2.appendChild(head(['What', 'Detail', 'Count']));
      const b = el('tbody');
      const add = (what, rows) =>
        rows.forEach((r) =>
          b.appendChild(
            el('tr', {}, [el('td', { text: what }), el('td', { class: 'mono', text: r.key }), el('td', { text: String(r.count) })]),
          ),
        );
      add('Status', a.status);
      add('Busiest paths', a.paths.slice(0, 5));
      add('Paths with 5xx', a.failedPaths);
      add('Top clients', a.clients);
      a.slowest.forEach((x) =>
        b.appendChild(
          el('tr', {}, [el('td', { text: 'Slowest' }), el('td', { class: 'mono', text: x.message }), el('td', { text: x.seconds + ' s' })]),
        ),
      );
      t2.appendChild(b);
    }

    const lv = $('lv');
    lv.textContent = '';
    levels = [];
    LogCore.LEVELS.concat(['UNKNOWN']).forEach((l) => {
      if (!s.levels[l]) return;
      const cb = el('input', { type: 'checkbox', value: l });
      cb.addEventListener('change', () => {
        levels = Array.prototype.filter.call(lv.querySelectorAll('input'), (c) => c.checked).map((c) => c.value);
        applyFilter();
      });
      lv.appendChild(el('label', { class: 'inline' }, [cb, document.createTextNode(' ' + l + ' (' + s.levels[l] + ')')]));
    });
    applyFilter();
  }

  function applyFilter() {
    try {
      matches = LogCore.filter(entries, { levels: levels, text: $('q').value, regex: $('rx').checked });
    } catch (e) {
      return setStatus($('fstatus'), e.message, 'error');
    }
    const shown = matches.slice(0, SHOW);
    $('lines').textContent = shown.map((e) => [e.raw].concat(e.extra.slice(0, 5)).join('\n')).join('\n');
    setStatus(
      $('fstatus'),
      matches.length +
        ' of ' +
        entries.length +
        ' entries match' +
        (matches.length > SHOW ? '; showing the first ' + SHOW + '. The CSV has all of them.' : '.'),
      'ok',
    );
  }

  $('go').addEventListener('click', analyse);
  $('sample').addEventListener('click', () => {
    $('text').value = LogCore.sample();
    analyse();
  });
  $('q').addEventListener('input', () => entries.length && applyFilter());
  $('rx').addEventListener('change', () => entries.length && applyFilter());
  $('copy').addEventListener('click', async () => {
    const ok = await copyText(LogCore.toText(summary));
    setStatus($('status'), ok === false ? 'Could not copy.' : 'Summary copied.', ok === false ? 'warn' : 'ok');
  });
  $('csv').addEventListener('click', () => {
    if (!matches.length) return setStatus($('fstatus'), 'Nothing to export.', 'warn');
    downloadBlob(new Blob([LogCore.toCsv(matches)], { type: 'text/csv;charset=utf-8' }), 'log-matches.csv');
  });
  bindDropzone($('drop'), $('file'), async (files) => {
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_FILE)
      return setStatus($('status'), 'That file is over 20 MB. Paste a smaller slice (for example the last hour).', 'error');
    $('text').value = await readText(file);
    analyse();
  });
})();
