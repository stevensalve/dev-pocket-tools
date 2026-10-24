/* JWT & Base64 Decoder - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  const subtle = window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  let outText = '';

  function showJwt(d) {
    $('jwt-card').hidden = false;
    $('text-card').hidden = true;
    const labels = { valid: 'Not expired', expired: 'Expired', 'not-yet': 'Not valid yet', 'no-expiry': 'No expiry' };
    $('state').className = 'pill ' + d.status;
    $('state').textContent = labels[d.status];
    $('state-text').textContent = d.statusText;
    $('warn').textContent = '';
    d.notes.concat(d.warnings).forEach((w) => $('warn').appendChild(el('li', { text: w })));
    $('header').textContent = JSON.stringify(d.header, null, 2);
    $('payload').textContent = JSON.stringify(d.payload, null, 2);
    const t = $('t-times');
    t.textContent = '';
    if (d.claims.length) {
      t.appendChild(
        el('thead', {}, [
          el(
            'tr',
            {},
            ['Claim', 'Value', 'UTC', 'IST'].map((h) => el('th', { scope: 'col', text: h })),
          ),
        ]),
      );
      const b = el('tbody');
      d.claims.forEach((c) =>
        b.appendChild(
          el('tr', {}, [
            el('td', { text: c.claim }),
            el('td', { text: String(c.value) }),
            el('td', { text: c.utc }),
            el('td', { text: c.ist }),
          ]),
        ),
      );
      t.appendChild(b);
    }
    outText = JSON.stringify({ header: d.header, payload: d.payload }, null, 2);
  }

  function showText(text) {
    $('jwt-card').hidden = true;
    $('text-card').hidden = false;
    $('out').textContent = text;
    outText = text;
  }

  function render() {
    setStatus($('status'), '', '');
    $('jwt-card').hidden = true;
    $('text-card').hidden = true;
    setStatus($('verify-status'), '', '');
    const src = $('src').value;
    if (!src.trim()) return;
    let mode = $('mode').value;
    if (mode === 'auto') {
      const g = JwtCore.detect(src);
      mode = g === 'jwt' ? 'jwt' : g === 'url' ? 'urld' : g === 'base64' ? 'b64d' : 'b64e';
      setStatus(
        $('status'),
        'Detected: ' +
          { jwt: 'a JWT', urld: 'URL-encoded text', b64d: 'Base64', b64e: 'plain text (shown as Base64)' }[mode] +
          '. Change "Treat it as" if that is wrong.',
        'ok',
      );
    }
    try {
      if (mode === 'jwt') showJwt(JwtCore.decodeJwt(src, Math.floor(Date.now() / 1000)));
      else if (mode === 'b64d') {
        const r = JwtCore.b64decode(src);
        showText(r.text);
        setStatus(
          $('status'),
          (r.urlSafe ? 'URL-safe Base64' : 'Base64') +
            ', ' +
            r.bytes +
            ' bytes' +
            (r.isText ? '.' : '. These bytes are not text, so a hex dump is shown.'),
          r.isText ? 'ok' : 'warn',
        );
      } else if (mode === 'b64e') showText(JwtCore.b64encode(src));
      else if (mode === 'b64u') showText(JwtCore.b64encode(src, { urlSafe: true, pad: false }));
      else if (mode === 'urld') showText(JwtCore.urlDecode(src));
      else if (mode === 'urle') showText(JwtCore.urlEncode(src));
      else if (mode === 'hexd') showText(JwtCore.hexDecode(src));
      else showText(JwtCore.hexEncode(src));
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
  }

  ['src', 'mode'].forEach((id) => $(id).addEventListener('input', render));
  $('demo').addEventListener('click', () => {
    $('src').value = JwtCore.sampleToken(Math.floor(Date.now() / 1000));
    $('mode').value = 'auto';
    render();
  });
  $('clear').addEventListener('click', () => {
    $('src').value = '';
    $('key').value = '';
    render();
  });
  $('copy').addEventListener('click', async () => {
    const ok = await copyText(outText);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the text and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('verify').addEventListener('click', async () => {
    try {
      const r = await JwtCore.verify(subtle, $('src').value, $('key').value);
      setStatus(
        $('verify-status'),
        r.ok ? 'Signature is valid for this ' + r.alg + ' key.' : 'Signature does NOT match this key.',
        r.ok ? 'ok' : 'error',
      );
    } catch (e) {
      setStatus($('verify-status'), e.message, 'error');
    }
  });
  render();
})();
