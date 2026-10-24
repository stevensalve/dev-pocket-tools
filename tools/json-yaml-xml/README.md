# JSON / YAML / XML Converter

> Format, validate and convert between JSON, YAML and XML, and query with a path.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Paste or drop JSON, YAML or XML. The tool detects the format, reports syntax errors with the line and column, pretty-prints or minifies, converts to either of the other two formats and shows what is inside (key, string and number counts, depth). A small path box such as `$.users[*].email` pulls values out.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/json-yaml-xml/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- json-yaml-xml ../json-yaml-xml-repo`.

## Features

- Auto-detect, validate and format with 2 or 4 spaces or a tab; minify and optional key sorting.
- Errors with line and column, including plain JSON mistakes such as trailing commas.
- Convert between JSON, YAML and XML, with a choice of root element name for XML.
- Path query: `$.a.b`, `$.a[0]`, `$.a[*].b`.
- Copy, download and sample data.

## How it works

`js/core.js` exports `DataCore`: `FORMATS`, `detect`, `parse`, `stringify`, `convert`, `stats`, `query` and `sample`. The parsing libraries are passed in as an argument, so the tests use the same packages as the page.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: js-yaml 5.5.0 (MIT) and fast-xml-parser 5.11.2 (MIT)                      |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- Pasted text may contain secrets (tokens, keys, passwords, customer data). It stays in this browser tab and is cleared when you close or reload the page, but do not paste production secrets on a shared or untrusted computer.

## Limitations

- YAML: a single document only (no `---` streams); anchors are resolved, custom tags are rejected.
- XML with a DOCTYPE is rejected on purpose (entity-expansion attacks). Attributes become `@_name` keys and mixed content is simplified, so XML to JSON to XML may not return identical text.
- Very large inputs (tens of MB) can make the tab slow. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/json-yaml-xml/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). js-yaml (MIT) and fast-xml-parser (MIT).
