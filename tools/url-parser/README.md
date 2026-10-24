# URL & Query Parser

> Split a URL into parts, edit its query parameters, and encode or decode values.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Paste a link to see the scheme, host, port, path, query parameters and fragment in a table. Edit, add, sort or remove parameters, strip tracking parameters, and copy the rebuilt link. A password inside a link is masked on screen.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/url-parser/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- url-parser ../url-parser-repo`.

## Features

- Parts table and a decoded parameter list (repeated keys kept).
- Edit and rebuild; sort parameters; remove `utm_*`, `fbclid`, `gclid` and similar.
- Copy the parameters as a JSON object, or build a query from JSON.
- The core can also resolve a relative link against a base address (`UrlCore.resolve`; no button on the page).
- Warnings for credentials in the link, secret-looking parameter names, double encoding and plain http.

## How it works

`js/core.js` exports `UrlCore`: `parse`, `rebuild`, `sortParams`, `stripTracking`, `toObject`, `fromObject`, `resolve` and `sample`.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- The tool has no third-party dependencies at all.
- Links often carry tokens in the query. The tool does not send them anywhere, but copying a rebuilt link puts it on your clipboard.

## Limitations

- It follows the browser URL standard; some unusual schemes and internationalised hosts are shown in their normalised form.
- Only text is parsed: the tool never opens or fetches a link.
- Tracking-parameter removal uses a built-in list and may miss new ones. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/url-parser/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
