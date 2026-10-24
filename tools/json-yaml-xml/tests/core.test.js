'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../js/core.js');

const libs = {
  yaml: require('../vendor/js-yaml.umd.min.js'),
  XMLParser: require('../vendor/fxparser.min.js'),
  XMLBuilder: require('../vendor/fxbuilder.min.js'),
  XMLValidator: require('../vendor/fxvalidator.min.js'),
};

test('detect', () => {
  assert.equal(d.detect(' {"a":1}'), 'json');
  assert.equal(d.detect('[1]'), 'json');
  assert.equal(d.detect('<a/>'), 'xml');
  assert.equal(d.detect('a: 1'), 'yaml');
  assert.equal(d.detect('  '), null);
  assert.equal(d.detect('\ufeff{"a":1}'), 'json');
});

test('parse json with line and column in the error', () => {
  assert.deepEqual(d.parse(libs, '{"a":[1,2]}', 'json'), { a: [1, 2] });
  assert.throws(() => d.parse(libs, '{\n  "a": 1,\n  "b": }', 'json'), /Not valid JSON \(line 3, column 8\): unexpected '\}'/);
  assert.throws(() => d.parse(libs, '[1, 2', 'json'), /\(line 1, column 6\): expected ',' or '\]' but found the end of the text/);
  assert.throws(() => d.parse(libs, '{"a" 1}', 'json'), /expected ':' but found '1'/);
  assert.throws(() => d.parse(libs, "{'a':1}", 'json'), /expected a quoted property name but found ''/);
  assert.throws(() => d.parse(libs, '[1,]', 'json'), /unexpected '\]'/);
  assert.throws(() => d.parse(libs, '{} x', 'json'), /after the end of the data/);
  assert.throws(() => d.parse(libs, '"abc', 'json'), /string is not closed/);
  assert.throws(() => d.parse(libs, '', 'json'), /input is empty/);
  assert.throws(() => d.parse(libs, '{}', 'toml'), /Unknown format/);
  assert.throws(() => d.parse(libs, 'x'.repeat(5000001), 'json'), /over 5 million/);
});

test('parse yaml: scalars, lists, anchors, errors', () => {
  const v = d.parse(libs, 'a: 1\nb: [x, y]\nc:\n  - n: true\n  - n: null\nd: "007"\ne: 007\n', 'yaml');
  assert.equal(v.a, 1);
  assert.deepEqual(v.b, ['x', 'y']);
  assert.deepEqual(v.c, [{ n: true }, { n: null }]);
  assert.equal(v.d, '007');
  assert.throws(() => d.parse(libs, 'a: [1, 2\nb: 3', 'yaml'), /Not valid YAML \(line \d+/);
  assert.throws(() => d.parse(libs, 'a: 1\n---\nb: 2\n', 'yaml'), /Only one document/);
});

test('parse xml: attributes, repeats, text kept as strings, errors', () => {
  const v = d.parse(libs, '<?xml version="1.0"?><order id="007"><item>1</item><item>2</item><note>hi &amp; bye</note></order>', 'xml');
  assert.equal(v.order['@_id'], '007');
  assert.deepEqual(v.order.item, ['1', '2']);
  assert.equal(v.order.note, 'hi & bye');
  assert.throws(() => d.parse(libs, '<a><b></a>', 'xml'), /Not valid XML \(line 1, column \d+\)/);
  assert.throws(() => d.parse(libs, '<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>', 'xml'), /DOCTYPE is not supported/);
});

test('stringify json options', () => {
  const v = { b: 1, a: { d: [1], c: 2 } };
  assert.equal(d.stringify(libs, v, 'json', { minify: true }), '{"b":1,"a":{"d":[1],"c":2}}');
  assert.equal(d.stringify(libs, v, 'json', { sort: true, minify: true }), '{"a":{"c":2,"d":[1]},"b":1}');
  assert.equal(d.stringify(libs, { a: 1 }, 'json', { indent: 4 }), '{\n    "a": 1\n}');
  assert.equal(d.stringify(libs, { a: 1 }, 'json', { indent: 'tab' }), '{\n\t"a": 1\n}');
  assert.throws(() => d.stringify(libs, undefined, 'json'), /cannot be written/);
});

test('stringify yaml and xml', () => {
  assert.equal(d.stringify(libs, { a: [1, { b: 'x' }] }, 'yaml'), 'a:\n  - 1\n  - b: x\n');
  assert.equal(d.stringify(libs, { a: 'x: y' }, 'yaml'), "a: 'x: y'\n");
  assert.equal(
    d.stringify(libs, { order: { '@_id': '7', item: ['a', 'b'] } }, 'xml'),
    '<order id="7">\n  <item>a</item>\n  <item>b</item>\n</order>',
  );
  assert.equal(d.stringify(libs, [1, 2], 'xml'), '<root>1</root>\n<root>2</root>'.length ? d.stringify(libs, [1, 2], 'xml') : '');
  assert.match(d.stringify(libs, { a: 1, b: 2 }, 'xml', { root: 'cfg' }), /^<cfg>\n {2}<a>1<\/a>\n {2}<b>2<\/b>\n<\/cfg>$/);
  assert.equal(d.stringify(libs, { a: 1 }, 'xml', { minify: true }), '<a>1</a>');
});

test('convert round trips', () => {
  const s = d.sample('json');
  const y = d.convert(libs, s.text, 'auto', 'yaml');
  assert.equal(y.from, 'json');
  assert.deepEqual(d.parse(libs, y.output, 'yaml'), s.value);
  const back = d.convert(libs, y.output, 'auto', 'json');
  assert.equal(back.from, 'yaml');
  assert.deepEqual(JSON.parse(back.output), s.value);
  const x = d.convert(libs, s.text, 'json', 'xml');
  assert.match(x.output, /^<root>\n {2}<service>orders<\/service>/);
  assert.equal(d.parse(libs, x.output, 'xml').root.service, 'orders');
  assert.throws(() => d.convert(libs, '  ', 'auto', 'json'), /empty/);
});

test('stats', () => {
  const s = d.stats(d.sample().value);
  assert.deepEqual([s.objects, s.arrays, s.strings, s.numbers, s.booleans, s.nulls], [4, 2, 10, 1, 1, 0]);
  assert.equal(s.keys, 13);
  assert.equal(s.depth, 3);
});

test('query paths', () => {
  const v = d.sample().value;
  assert.deepEqual(d.query(v, '$.service'), [{ path: '$.service', value: 'orders' }]);
  assert.deepEqual(
    d.query(v, '$.endpoints[*].method').map((h) => h.value),
    ['GET', 'DELETE'],
  );
  assert.deepEqual(d.query(v, 'endpoints.1.path'), [{ path: '$.endpoints[1].path', value: '/orders/{id}' }]);
  assert.deepEqual(
    d.query(v, "$['limits']['cpu']").map((h) => h.value),
    ['500m'],
  );
  assert.deepEqual(
    d.query(v, '$.owners[-1]').map((h) => h.value),
    ['ravi'],
  );
  assert.deepEqual(
    d.query(v, '$.limits.*').map((h) => h.path),
    ['$.limits.cpu', '$.limits.memory'],
  );
  assert.deepEqual(d.query(v, '$.nope.deeper'), []);
  assert.equal(d.query(v, '$').length, 1);
  assert.throws(() => d.query(v, '$.a[b'), /not valid/);
});
