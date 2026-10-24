/* Hash & UUID Generator - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText, readArrayBuffer } = OT;
  const $ = (id) => document.getElementById(id);
  const MAX_FILE = 200 * 1024 * 1024;
  const env = {
    subtle: window.crypto && window.crypto.subtle ? window.crypto.subtle : null,
    getRandomValues: (b) => window.crypto.getRandomValues(b),
    get nowMs() {
      return Date.now();
    },
  };
  let input = { bytes: null, label: '' };
  let digests = {};
  let seq = 0;

  async function hashNow() {
    const my = ++seq;
    const bytes = input.bytes || new TextEncoder().encode($('text').value);
    const empty = !input.bytes && !$('text').value;
    const t = $('t-hash');
    t.textContent = '';
    digests = {};
    if (empty) {
      setStatus($('status'), '', '');
      renderVerdict();
      return renderHmac();
    }
    try {
      for (const a of HashCore.ALGOS) digests[a.id] = await HashCore.digest(env, bytes, a.id);
    } catch (e) {
      return setStatus($('status'), e.message, 'error');
    }
    if (my !== seq) return;
    setStatus($('status'), input.bytes ? input.label : 'Hashing the typed text (' + bytes.length + ' bytes, UTF-8).', 'ok');
    t.appendChild(
      el('thead', {}, [
        el(
          'tr',
          {},
          ['Algorithm', 'Digest', ''].map((h) => el('th', { scope: 'col', text: h })),
        ),
      ]),
    );
    const b = el('tbody');
    HashCore.ALGOS.forEach((a) => {
      const btn = el('button', { type: 'button', text: 'Copy', 'aria-label': 'Copy ' + a.id });
      btn.addEventListener('click', async () => {
        const ok = await copyText(digests[a.id]);
        setStatus($('out-status'), ok === false ? 'Could not copy.' : a.id + ' copied.', ok === false ? 'warn' : 'ok');
      });
      b.appendChild(
        el('tr', {}, [
          el('td', {}, [
            el('strong', { text: a.id }),
            a.legacy ? el('div', { class: 'hint', text: 'legacy' }) : document.createTextNode(''),
          ]),
          el('td', { class: 'mono', text: digests[a.id] }),
          el('td', {}, [btn]),
        ]),
      );
    });
    t.appendChild(b);
    renderVerdict();
    renderHmac();
  }

  function renderVerdict() {
    const v = $('verdict');
    v.textContent = '';
    const pasted = $('expected').value;
    if (!pasted.trim() || !Object.keys(digests).length) return;
    const c = HashCore.cleanChecksum(pasted);
    const algo = c.algo || 'SHA-256';
    const r = HashCore.compare(digests[algo], pasted, algo);
    v.textContent = (c.algo ? '' : 'Assuming SHA-256. ') + r.message;
    v.className = r.ok === true ? 'ok' : r.ok === false ? 'late' : '';
  }

  async function renderHmac() {
    const out = $('hmac');
    out.textContent = '';
    if (!$('hkey').value) return;
    try {
      const bytesText = input.bytes ? null : $('text').value;
      if (bytesText === null) return (out.textContent = 'HMAC uses typed text. Clear the file to use it.');
      out.textContent = await HashCore.hmac(env, $('hkey').value, bytesText, $('halgo').value);
    } catch (e) {
      out.textContent = e.message;
    }
  }

  function genUuids() {
    try {
      $('uout').textContent = HashCore.uuids(env, Number($('ucount').value), Number($('uver').value), {
        upper: $('uupper').checked,
        noDashes: $('unodash').checked,
        braces: $('ubrace').checked,
      }).join('\n');
    } catch (e) {
      $('uout').textContent = e.message;
    }
  }

  function inspectUuid() {
    const i = $('uin').value;
    $('uinfo').textContent = i.trim() ? HashCore.inspect(i).message : '';
  }

  $('text').addEventListener('input', () => {
    input = { bytes: null, label: '' };
    hashNow();
  });
  OT.bindDropzone($('drop'), $('file'), async (files) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_FILE)
      return setStatus($('status'), 'That file is over 200 MB. Use a command-line tool such as sha256sum for files this large.', 'error');
    try {
      setStatus($('status'), 'Reading ' + f.name + '...', '');
      const buf = await readArrayBuffer(f);
      input = { bytes: new Uint8Array(buf), label: f.name + ': ' + f.size.toLocaleString('en-US') + ' bytes' };
      $('text').value = '';
      await hashNow();
    } catch (e) {
      setStatus($('status'), 'Could not read that file.', 'error');
    }
  });
  ['expected'].forEach((id) => $(id).addEventListener('input', renderVerdict));
  ['hkey', 'halgo'].forEach((id) => $(id).addEventListener('input', renderHmac));
  $('ugen').addEventListener('click', genUuids);
  ['uver', 'ucount', 'uupper', 'unodash', 'ubrace'].forEach((id) => $(id).addEventListener('input', genUuids));
  $('uin').addEventListener('input', inspectUuid);
  $('ucopy').addEventListener('click', async () => {
    const ok = await copyText($('uout').textContent);
    setStatus($('out-status'), ok === false ? 'Could not copy.' : 'Copied.', ok === false ? 'warn' : 'ok');
  });
  genUuids();
})();
