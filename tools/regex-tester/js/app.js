/* Regex Tester - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  const flagBoxes = {};
  RegexCore.FLAGS.forEach((f) => {
    const cb = el('input', { type: 'checkbox', id: 'flag-' + f[0] });
    flagBoxes[f[0]] = cb;
    cb.addEventListener('input', render);
    $('flags').appendChild(el('label', { class: 'inline', title: f[2] }, [cb, ' ' + f[0] + ' (' + f[1] + ')']));
  });
  flagBoxes.g.checked = true;
  $('snippet').appendChild(el('option', { value: '', text: 'Choose...' }));
  RegexCore.SNIPPETS.forEach((s, i) => $('snippet').appendChild(el('option', { value: String(i), text: s.name })));

  const flags = () =>
    Object.keys(flagBoxes)
      .filter((k) => flagBoxes[k].checked)
      .join('');

  function render() {
    ['hl', 'stats', 't-matches', 'warn', 't-explain', 'replaced'].forEach((id) => ($(id).textContent = ''));
    setStatus($('status'), '', '');
    const pattern = $('pattern').value;
    if (!pattern) return;
    let res;
    try {
      RegexCore.compile(pattern, flags());
      res = RegexCore.run(pattern, flags(), $('text').value);
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    res.warnings.forEach((w) => $('warn').appendChild(el('li', { text: w })));
    if (res.canBeEmpty) $('warn').appendChild(el('li', { text: 'This pattern can match empty text, so it may match at every position.' }));
    const text = $('text').value;
    RegexCore.segments(text, res.matches).forEach((s) =>
      $('hl').appendChild(s.match === null ? document.createTextNode(s.text) : el('mark', { class: 'm' + (s.match % 2), text: s.text })),
    );
    if (!text) $('hl').textContent = '';
    const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: String(v) }), label]);
    $('stats').appendChild(stat('Matches', res.matches.length + (res.truncated ? '+' : '')));
    if (res.truncated) setStatus($('status'), 'Showing the first ' + RegexCore.MAX_MATCHES + ' matches.', 'warn');
    if (res.matches.length) {
      const t = $('t-matches');
      const groupCount = Math.max.apply(
        null,
        res.matches.map((m) => m.groups.length),
      );
      t.appendChild(
        el('thead', {}, [
          el(
            'tr',
            {},
            ['#', 'Match', 'Line:col']
              .concat(Array.from({ length: groupCount }, (_, i) => 'Group ' + (i + 1)))
              .map((h) => el('th', { scope: 'col', text: h })),
          ),
        ]),
      );
      const b = el('tbody');
      res.matches.slice(0, 200).forEach((m, i) => {
        const cells = [
          el('td', { text: String(i + 1) }),
          el('td', {}, [el('span', { class: 'tok', text: m.text === '' ? '(empty)' : m.text })]),
          el('td', { text: m.line + ':' + m.col }),
        ];
        for (let g = 0; g < groupCount; g++) {
          const gr = m.groups[g];
          cells.push(el('td', { text: gr ? (gr.name ? gr.name + ' = ' : '') + (gr.text === null ? '(no match)' : gr.text) : '' }));
        }
        b.appendChild(el('tr', {}, cells));
      });
      t.appendChild(b);
    }
    const ex = $('t-explain');
    ex.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Part', 'Meaning'].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const eb = el('tbody');
    RegexCore.explain(pattern).forEach((x) =>
      eb.appendChild(
        el('tr', {}, [el('td', {}, [el('span', { class: 'tok', text: x.token })]), el('td', { text: '  '.repeat(x.depth) + x.meaning })]),
      ),
    );
    ex.appendChild(eb);
    try {
      $('replaced').textContent =
        $('repl').value === '' && !$('repl').dataset.touched ? '' : RegexCore.replace(pattern, flags(), text, $('repl').value);
    } catch (e) {
      $('replaced').textContent = e.message;
    }
  }

  ['pattern', 'text'].forEach((id) => $(id).addEventListener('input', render));
  $('repl').addEventListener('input', () => {
    $('repl').dataset.touched = '1';
    render();
  });
  $('snippet').addEventListener('change', () => {
    const s = RegexCore.SNIPPETS[Number($('snippet').value)];
    if (!s) return;
    $('pattern').value = s.pattern;
    Object.keys(flagBoxes).forEach((k) => (flagBoxes[k].checked = s.flags.indexOf(k) !== -1));
    $('text').value = s.yes.concat(s.no).join('\n');
    flagBoxes.m.checked = true;
    render();
  });
  $('demo').addEventListener('click', () => {
    const s = RegexCore.sample();
    $('pattern').value = s.pattern;
    Object.keys(flagBoxes).forEach((k) => (flagBoxes[k].checked = s.flags.indexOf(k) !== -1));
    $('text').value = s.text;
    $('repl').value = '$<user> at $<host>';
    $('repl').dataset.touched = '1';
    render();
  });
  $('copy-repl').addEventListener('click', async () => {
    const ok = await copyText($('replaced').textContent);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('copy-pat').addEventListener('click', async () => {
    const ok = await copyText('/' + $('pattern').value + '/' + flags());
    setStatus($('out-status'), ok === false ? 'Could not copy.' : 'Copied.', ok === false ? 'warn' : 'ok');
  });
  render();
})();
