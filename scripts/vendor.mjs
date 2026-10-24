#!/usr/bin/env node
/**
 * Copies third-party browser bundles from node_modules into each tool's
 * `vendor/` folder so the tools work offline (no CDN needed).
 *
 * Usage: npm install && npm run vendor
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);

/** Library catalogue: where each browser bundle lives inside node_modules. */
const LIBS = {
  'js-yaml': {
    pkg: 'js-yaml',
    url: 'https://github.com/nodeca/js-yaml',
    files: [['dist/browser/js-yaml.umd.min.js', 'js-yaml.umd.min.js']],
    license: 'LICENSE',
  },
  'fast-xml-parser': {
    pkg: 'fast-xml-parser',
    url: 'https://github.com/NaturalIntelligence/fast-xml-parser',
    files: [
      ['lib/fxparser.min.js', 'fxparser.min.js'],
      ['lib/fxbuilder.min.js', 'fxbuilder.min.js'],
      ['lib/fxvalidator.min.js', 'fxvalidator.min.js'],
    ],
    license: 'LICENSE',
  },
};

/** Which libraries each tool needs. */
const TOOLS = {
  'json-yaml-xml': ['js-yaml', 'fast-xml-parser'],
  'regex-tester': [],
  'cron-explainer': [],
  'jwt-base64': [],
  'diff-viewer': [],
  'timestamp-converter': [],
  'url-parser': [],
  'hash-uuid': [],
  'log-analyser': [],
  'semver-changelog': [],
};

const MIT_TEXT = (notice) => `MIT License

${notice}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const readPkg = (name) => JSON.parse(readFileSync(nm(name, 'package.json'), 'utf8'));

for (const [tool, libs] of Object.entries(TOOLS)) {
  if (libs.length === 0) continue;
  const dest = join(root, 'tools', tool, 'vendor');
  mkdirSync(dest, { recursive: true });
  const rows = [];
  for (const key of libs) {
    const lib = LIBS[key];
    const meta = readPkg(lib.pkg);
    for (const [src, name] of lib.files) copyFileSync(nm(lib.pkg, src), join(dest, name));
    if (lib.license && existsSync(nm(lib.pkg, lib.license))) {
      copyFileSync(nm(lib.pkg, lib.license), join(dest, `LICENSE-${key}.txt`));
    } else if (lib.generatedLicense) {
      writeFileSync(join(dest, `LICENSE-${key}.txt`), MIT_TEXT(lib.generatedLicense));
    }
    rows.push(`| ${meta.name} | ${meta.version} | ${meta.license} | ${lib.files.map((f) => '`' + f[1] + '`').join(', ')} | ${lib.url} |`);
  }
  const readme = `# Vendored third-party code

These files are unmodified copies of open-source libraries, bundled so the tool
works **offline**. Do not edit them by hand. To refresh them run
\`npm install && npm run vendor\` from the repository root.

| Package | Version | License | Files | Upstream |
| ------- | ------- | ------- | ----- | -------- |
${rows.join('\n')}
`;
  writeFileSync(join(dest, 'README.md'), readme);
  console.log(`vendored ${libs.join(', ')} -> tools/${tool}/vendor`);
}
