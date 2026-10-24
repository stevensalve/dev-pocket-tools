/* Diff Viewer - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  let unifiedText = '';
  let names = ['original', 'changed'];

  function addWords(td, parts) {
    parts.forEach((p) => td.appendChild(p.changed ? el('mark', { class: 'chg', text: p.text }) : document.createTextNode(p.text)));
  }

  function render() {
    ['stats', 'notes', 't-diff', 'unified'].forEach((id) => ($(id).textContent = ''));
    setStatus($('status'), '', '');
    unifiedText = '';
    if (!$('a').value && !$('b').value) return;
    let r;
    try {
      r = DiffCore.diff($('a').value, $('b').value, { ignoreWhitespace: $('ws').checked, ignoreCase: $('case').checked });
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    const stat = (label, v, bad) => el('div', { class: 'stat' + (bad ? ' bad' : '') }, [el('b', { text: String(v) }), label]);
    $('stats').appendChild(stat('Added', r.added));
    $('stats').appendChild(stat('Removed', r.removed, r.removed > 0));
    $('stats').appendChild(stat('Unchanged', r.same));
    $('stats').appendChild(stat('Similar', Math.round(r.similarity * 100) + '%'));
    r.notes.forEach((n) => $('notes').appendChild(el('li', { text: n })));
    if (r.identical)
      setStatus(
        $('status'),
        'The two versions are identical' + ($('ws').checked || $('case').checked ? ' with these options.' : '.'),
        'ok',
      );
    let rows = DiffCore.sideBySide(r.rows);
    if ($('only').checked) {
      const keep = new Set();
      rows.forEach((x, i) => {
        if (x.type !== 'eq') for (let k = Math.max(0, i - 3); k <= Math.min(rows.length - 1, i + 3); k++) keep.add(k);
      });
      rows = rows.filter((x, i) => keep.has(i));
    }
    const t = $('t-diff');
    const body = el('tbody');
    rows.forEach((x) => {
      const L = el('td', { class: x.left ? (x.type === 'eq' ? '' : 'del') : 'empty' });
      const R = el('td', { class: x.right ? (x.type === 'eq' ? '' : 'add') : 'empty' });
      if (x.type === 'change') {
        const w = DiffCore.words(x.left.text, x.right.text);
        addWords(L, w.left);
        addWords(R, w.right);
      } else {
        if (x.left) L.textContent = x.left.text;
        if (x.right) R.textContent = x.right.text;
      }
      body.appendChild(
        el('tr', { class: x.type }, [
          el('td', { class: 'no', text: x.left ? String(x.left.no) : '' }),
          L,
          el('td', { class: 'no', text: x.right ? String(x.right.no) : '' }),
          R,
        ]),
      );
    });
    t.appendChild(body);
    unifiedText = DiffCore.unified(r.rows, names[0], names[1], 3);
    $('unified').textContent = unifiedText || 'No differences.';
  }

  ['a', 'b', 'ws', 'case', 'only'].forEach((id) => $(id).addEventListener('input', render));
  ['a', 'b'].forEach((side, i) => {
    $('f' + side).addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      try {
        $(side).value = await readText(f);
        names[i] = f.name;
        render();
      } catch (e) {
        setStatus($('status'), 'Could not read that file.', 'error');
      }
    });
  });
  $('demo').addEventListener('click', () => {
    const s = DiffCore.sample();
    $('a').value = s.a;
    $('b').value = s.b;
    names = ['config.old.yaml', 'config.new.yaml'];
    render();
  });
  $('swap').addEventListener('click', () => {
    const t = $('a').value;
    $('a').value = $('b').value;
    $('b').value = t;
    names.reverse();
    render();
  });
  $('clear').addEventListener('click', () => {
    $('a').value = '';
    $('b').value = '';
    names = ['original', 'changed'];
    render();
  });
  $('copy').addEventListener('click', async () => {
    if (!unifiedText) return setStatus($('out-status'), 'There are no differences to copy.', 'warn');
    const ok = await copyText(unifiedText);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('download').addEventListener('click', () =>
    unifiedText
      ? downloadBlob(unifiedText, 'changes.diff', 'text/x-diff;charset=utf-8')
      : setStatus($('out-status'), 'There are no differences to download.', 'warn'),
  );
  render();
})();
