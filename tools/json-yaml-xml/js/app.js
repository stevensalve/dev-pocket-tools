/* JSON / YAML / XML Converter - user interface. All rules live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el, copyText } = OT;
  const $ = (id) => document.getElementById(id);
  const libs = { yaml: window.jsyaml, XMLParser: window.XMLParser, XMLBuilder: window.XMLBuilder, XMLValidator: window.XMLValidator };
  const EXT = { json: 'json', yaml: 'yaml', xml: 'xml' };
  const MIME = { json: 'application/json', yaml: 'text/yaml', xml: 'application/xml' };
  let result = null;
  let value;

  function opts() {
    const ind = $('indent').value;
    return {
      indent: ind === 'tab' ? 'tab' : Number(ind),
      sort: $('sort').checked,
      minify: $('minify').checked,
      root: $('root').value.trim(),
    };
  }

  function render() {
    $('stats').textContent = '';
    $('out').textContent = '';
    result = null;
    value = undefined;
    setStatus($('status'), '', '');
    if (!$('src').value.trim()) return renderQuery();
    try {
      result = DataCore.convert(libs, $('src').value, $('from').value, $('to').value, opts());
      value = result.value;
    } catch (e) {
      setStatus($('status'), e.message, 'error');
      return renderQuery();
    }
    $('out').textContent = result.output;
    setStatus($('status'), 'Read as ' + result.from.toUpperCase() + ', written as ' + result.to.toUpperCase() + '.', 'ok');
    const s = DataCore.stats(result.value);
    const stat = (label, v) => el('div', { class: 'stat' }, [el('b', { text: String(v) }), label]);
    [
      ['Keys', s.keys],
      ['Objects', s.objects],
      ['Arrays', s.arrays],
      ['Depth', s.depth],
      ['Characters out', result.output.length],
    ].forEach((x) => $('stats').appendChild(stat(x[0], x[1])));
    renderQuery();
  }

  function renderQuery() {
    const p = $('path').value.trim();
    const box = $('hits');
    box.textContent = '';
    if (!p || value === undefined) return;
    try {
      const hits = DataCore.query(value, p);
      box.textContent = hits.length
        ? hits
            .map((h) => h.path + ' = ' + (typeof h.value === 'string' ? JSON.stringify(h.value) : JSON.stringify(h.value, null, 2)))
            .join('\n')
        : 'No match.';
    } catch (e) {
      box.textContent = e.message;
    }
  }

  ['src', 'from', 'to', 'indent', 'sort', 'minify', 'root'].forEach((id) => $(id).addEventListener('input', render));
  $('path').addEventListener('input', renderQuery);
  $('demo').addEventListener('click', () => {
    $('src').value = DataCore.sample('json').text;
    $('from').value = 'auto';
    $('to').value = 'yaml';
    render();
  });
  $('clear').addEventListener('click', () => {
    $('src').value = '';
    render();
  });
  $('copy').addEventListener('click', async () => {
    if (!result) return setStatus($('out-status'), 'There is no output yet.', 'warn');
    const ok = await copyText(result.output);
    setStatus(
      $('out-status'),
      ok === false ? 'Could not copy. Select the output and copy it yourself.' : 'Copied.',
      ok === false ? 'warn' : 'ok',
    );
  });
  $('download').addEventListener('click', () => {
    if (!result) return setStatus($('out-status'), 'There is no output yet.', 'warn');
    downloadBlob(result.output, 'converted.' + EXT[result.to], MIME[result.to] + ';charset=utf-8');
  });
  OT.bindDropzone($('drop'), $('file'), async (files) => {
    if (!files[0]) return;
    try {
      $('src').value = await readText(files[0]);
      render();
    } catch (e) {
      setStatus($('status'), 'Could not read that file.', 'error');
    }
  });
  render();
})();
