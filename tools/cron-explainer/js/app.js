/* Cron Explainer - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  const ZONES = [
    ['IST (UTC+05:30)', 330],
    ['UTC', 0],
    ['UTC+01:00', 60],
    ['UTC+08:00', 480],
    ['UTC-05:00', -300],
    ['UTC-08:00', -480],
  ];
  ZONES.forEach((z) => $('tz').appendChild(el('option', { value: String(z[1]), text: z[0] })));
  $('preset').appendChild(el('option', { value: '', text: 'Choose...' }));
  CronCore.PRESETS.forEach((p) => $('preset').appendChild(el('option', { value: p[1], text: p[0] })));

  const fmt = (w) => {
    const d = w.slice(0, 10);
    const dow = CronCore.DAYS[new Date(Date.UTC(+w.slice(0, 4), +w.slice(5, 7) - 1, +w.slice(8, 10))).getUTCDay()].slice(0, 3);
    return dow + ' ' + OT.formatDate(d, 'dmy') + ' ' + w.slice(11);
  };

  function render() {
    ['plain', 'warn', 'fields', 't-next'].forEach((id) => ($(id).textContent = ''));
    setStatus($('status'), '', '');
    const expr = $('expr').value;
    if (!expr.trim()) return;
    let text;
    try {
      text = CronCore.explain(expr);
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    $('plain').textContent = text + '.';
    CronCore.warnings(expr).forEach((w) => $('warn').appendChild(el('li', { text: w })));
    const parsed = CronCore.parse(expr);
    const names = ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'];
    const f = $('fields');
    f.appendChild(
      el('tbody', {}, [
        el(
          'tr',
          {},
          names.map((n) => el('th', { scope: 'col', text: n })),
        ),
        el(
          'tr',
          {},
          parsed.parts.map((p) => el('td', { text: p })),
        ),
      ]),
    );
    const off = Number($('tz').value);
    const now = new Date();
    const wallNow = CronCore.shift(now.toISOString().slice(0, 16), off);
    const runs = CronCore.next(expr, wallNow, Number($('count').value) || 10);
    const t = $('t-next');
    if (!runs.length) {
      t.appendChild(el('tbody', {}, [el('tr', {}, [el('td', { text: 'This schedule never runs (for example, 30 February).' })])]));
      return;
    }
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['#', 'Schedule time', 'In UTC', 'In IST', 'From now'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const b = el('tbody');
    runs.forEach((r, i) => {
      const utc = CronCore.shift(r, -off);
      const mins = Math.round((Date.parse(utc + ':00Z') - now.getTime()) / 60000);
      const rel =
        mins < 60 ? mins + ' min' : mins < 2880 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : Math.round(mins / 1440) + ' days';
      b.appendChild(
        el('tr', {}, [
          el('td', { text: String(i + 1) }),
          el('td', { text: fmt(r) }),
          el('td', { text: fmt(utc) }),
          el('td', { text: fmt(CronCore.shift(utc, 330)) }),
          el('td', { text: rel }),
        ]),
      );
    });
    t.appendChild(b);
  }

  ['expr', 'tz', 'count'].forEach((id) => $(id).addEventListener('input', render));
  $('preset').addEventListener('change', () => {
    if ($('preset').value) {
      $('expr').value = $('preset').value;
      render();
    }
  });
  $('copy').addEventListener('click', async () => {
    const ok = await copyText($('expr').value.trim());
    setStatus($('out-status'), ok === false ? 'Could not copy.' : 'Expression copied.', ok === false ? 'warn' : 'ok');
  });
  $('copy-text').addEventListener('click', async () => {
    const ok = await copyText($('expr').value.trim() + ' = ' + $('plain').textContent);
    setStatus($('out-status'), ok === false ? 'Could not copy.' : 'Explanation copied.', ok === false ? 'warn' : 'ok');
  });
  render();
})();
