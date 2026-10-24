/* URL & Query Parser - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  let params = [];
  let parsedFor = null;

  function parseNow() {
    const text = $('src').value;
    if (text === parsedFor) return true;
    parsedFor = text;
    ['warn', 'notes', 't-parts', 't-params', 'rebuilt', 'json'].forEach((id) => ($(id).textContent = ''));
    setStatus($('status'), '', '');
    params = [];
    if (!text.trim()) return false;
    try {
      const p = UrlCore.parse(text);
      params = p.params.map((x) => ({ key: x.key, value: x.value }));
      p.warnings.forEach((w) => $('warn').appendChild(el('li', { text: w })));
      p.notes.forEach((n) => $('notes').appendChild(el('li', { text: n })));
      const rows = [
        ['Scheme', p.protocol],
        ['User name', p.username],
        ['Password', p.password],
        ['Host', p.hostname + (p.isIp ? ' (IP address)' : '')],
        ['Port', p.port ? p.port : p.effectivePort ? p.effectivePort + ' (default)' : ''],
        ['Origin', p.origin],
        ['Path', p.pathname],
        ['Path segments', p.segments.join('  /  ')],
        ['Fragment', p.hash],
      ].filter((r) => r[1]);
      const t = $('t-parts');
      t.appendChild(
        el(
          'tbody',
          {},
          rows.map((r) => el('tr', {}, [el('th', { scope: 'row', text: r[0] }), el('td', { class: 'mono', text: r[1] })])),
        ),
      );
      return true;
    } catch (e) {
      setStatus($('status'), e.message, 'error');
      parsedFor = null;
      return false;
    }
  }

  function hashOf() {
    try {
      return UrlCore.parse($('src').value).hash;
    } catch (e) {
      return '';
    }
  }

  function renderParams() {
    const t = $('t-params');
    t.textContent = '';
    ['rebuilt', 'json'].forEach((id) => ($(id).textContent = ''));
    if (!$('src').value.trim() || parsedFor === null) return;
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Name', 'Value', 'Decoded value', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const b = el('tbody');
    params.forEach((p, i) => {
      const k = el('input', { type: 'text', value: p.key, 'aria-label': 'Parameter name ' + (i + 1), class: 'code' });
      const v = el('input', { type: 'text', value: p.value, 'aria-label': 'Value of ' + (p.key || 'parameter ' + (i + 1)), class: 'code' });
      k.addEventListener('input', () => {
        params[i].key = k.value;
        renderOut();
      });
      v.addEventListener('input', () => {
        params[i].value = v.value;
        renderOut();
      });
      const del = el('button', { type: 'button', text: 'Remove', 'aria-label': 'Remove parameter ' + (p.key || i + 1) });
      del.addEventListener('click', () => {
        params.splice(i, 1);
        renderParams();
      });
      b.appendChild(
        el('tr', {}, [
          el('td', {}, [k]),
          el('td', {}, [v]),
          el('td', { class: 'mono', text: p.value === '' ? '' : JSON.stringify(p.value) }),
          el('td', {}, [del]),
        ]),
      );
    });
    t.appendChild(b);
    renderOut();
  }

  function renderOut() {
    try {
      $('rebuilt').textContent = UrlCore.rebuild($('src').value, params, hashOf());
      $('json').textContent = JSON.stringify(UrlCore.toObject(params.filter((p) => p.key !== '')), null, 2);
    } catch (e) {
      $('rebuilt').textContent = e.message;
    }
  }

  function renderJson() {
    const out = $('from-json-out');
    try {
      const list = UrlCore.fromObject(JSON.parse($('from-json').value));
      const sp = new URLSearchParams();
      list.forEach((p) => sp.append(p.key, p.value));
      out.textContent = sp.toString();
    } catch (e) {
      out.textContent = e instanceof SyntaxError ? 'That is not valid JSON.' : e.message;
    }
  }

  function render() {
    if (parseNow()) renderParams();
    else renderParams();
  }

  $('src').addEventListener('input', render);
  $('demo').addEventListener('click', () => {
    $('src').value = UrlCore.sample();
    render();
  });
  $('clear').addEventListener('click', () => {
    $('src').value = '';
    render();
  });
  $('add').addEventListener('click', () => {
    if (parsedFor === null) return;
    params.push({ key: '', value: '' });
    renderParams();
  });
  $('sort').addEventListener('click', () => {
    params = UrlCore.sortParams(params);
    renderParams();
  });
  $('strip').addEventListener('click', () => {
    const r = UrlCore.stripTracking(params);
    params = r.params;
    renderParams();
    setStatus(
      $('out-status'),
      r.removed.length ? 'Removed: ' + r.removed.join(', ') + '.' : 'No tracking codes found.',
      r.removed.length ? 'ok' : 'warn',
    );
  });
  $('copy').addEventListener('click', async () => {
    const ok = await copyText($('rebuilt').textContent);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('from-json').addEventListener('input', renderJson);
  renderJson();
  render();
})();
