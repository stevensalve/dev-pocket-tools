/* Timestamp Converter - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  let current = null;
  let timer = null;
  TimeCore.ZONES.forEach((z) => $('zone').appendChild(el('option', { value: z[0], text: z[1] + ' (' + z[0] + ')' })));
  $('src').value = 'now';

  function render() {
    ['stats', 't-zones'].forEach((id) => ($(id).textContent = ''));
    $('rel').textContent = '';
    setStatus($('status'), '', '');
    current = null;
    const now = Date.now();
    try {
      const p = TimeCore.parse($('src').value, $('zone').value, now);
      const d = TimeCore.describe(p.ms, now);
      current = d;
      setStatus($('status'), 'Read as ' + p.kind + '.', 'ok');
      const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: v }), label]);
      $('stats').appendChild(stat('Unix seconds', String(d.seconds)));
      $('stats').appendChild(stat('Milliseconds', String(d.milliseconds)));
      $('stats').appendChild(stat('UTC', d.isoUtc.slice(0, 19).replace('T', ' ')));
      $('rel').textContent = d.relative.charAt(0).toUpperCase() + d.relative.slice(1) + '.';
      const t = $('t-zones');
      t.appendChild(
        el('thead', {}, [
          el(
            'tr',
            {},
            ['Place', 'Date', 'Time', 'Day', 'Offset', 'ISO 8601'].map((h) => el('th', { scope: 'col', text: h })),
          ),
        ]),
      );
      const b = el('tbody');
      d.zones.forEach((z) => {
        const label = TimeCore.ZONES.find((x) => x[0] === z.zone)[1];
        b.appendChild(
          el('tr', {}, [
            el('td', {}, [el('strong', { text: label })]),
            el('td', { text: z.date }),
            el('td', { text: z.time }),
            el('td', { text: z.weekday }),
            el('td', { text: z.offsetLabel }),
            el('td', { text: z.iso }),
          ]),
        );
      });
      t.appendChild(b);
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
    renderDiff();
  }

  function renderDiff() {
    const out = $('diff');
    out.textContent = '';
    if (!$('d1').value.trim() || !$('d2').value.trim()) return;
    try {
      const now = Date.now();
      const a = TimeCore.parse($('d1').value, $('zone').value, now);
      const b = TimeCore.parse($('d2').value, $('zone').value, now);
      const r = TimeCore.between(a.ms, b.ms);
      out.textContent = (r.ms < 0 ? 'The second moment is earlier by ' : 'The second moment is later by ') + r.text + '.';
    } catch (e) {
      out.textContent = e.message;
    }
  }

  ['src', 'zone'].forEach((id) => $(id).addEventListener('input', render));
  ['d1', 'd2'].forEach((id) => $(id).addEventListener('input', renderDiff));
  $('now').addEventListener('click', () => {
    $('src').value = 'now';
    render();
  });
  $('live').addEventListener('click', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      $('live').textContent = 'Live clock: off';
    } else {
      $('src').value = 'now';
      timer = setInterval(() => {
        if ($('src').value.trim().toLowerCase() === 'now') render();
        else $('live').click();
      }, 1000);
      $('live').textContent = 'Live clock: on';
      render();
    }
  });
  const copy = async (text, label) => {
    if (!current) return setStatus($('out-status'), 'Enter a valid time first.', 'warn');
    const ok = await copyText(text());
    setStatus($('out-status'), ok === false ? 'Could not copy.' : label + ' copied.', ok === false ? 'warn' : 'ok');
  };
  $('copy-s').addEventListener('click', () => copy(() => String(current.seconds), 'Unix seconds'));
  $('copy-ms').addEventListener('click', () => copy(() => String(current.milliseconds), 'Milliseconds'));
  $('copy-iso').addEventListener('click', () => copy(() => current.isoUtc, 'ISO time'));
  render();
})();
