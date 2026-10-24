# Timestamp Converter

> Convert Unix timestamps and dates between UTC, IST and other zones, with relative time.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Paste a Unix timestamp (seconds, milliseconds, microseconds or nanoseconds), an ISO date or a date such as `23/10/2026 4:30 pm` and see it in UTC, IST and any zones you pick, with "3 hours ago" style relative time. A second card gives the time between two moments.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/timestamp-converter/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- timestamp-converter ../timestamp-converter-repo`.

## Features

- Auto-detects the unit of a Unix timestamp by its digit count.
- Understands ISO 8601, `DD/MM/YYYY` (with am/pm) and `23 Oct 2026`.
- Shows UTC, IST and common zones with their offsets (daylight saving handled by your browser); choose the zone that plain dates are read in.
- Handles clock changes: a time that does not exist or occurs twice is resolved and flagged.
- Duration between two moments in days, hours, minutes and seconds.

## How it works

`js/core.js` exports `TimeCore`: `ZONES`, `offsetAt`, `offsetLabel`, `wallToMs`, `parse`, `relative`, `show`, `describe` and `between`. The current time is passed in, so results are repeatable.

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

## Limitations

- Zone rules come from your browser; an old browser may have outdated daylight-saving rules.
- `DD/MM/YYYY` is assumed for dates with slashes. Write the month as a word if that could be ambiguous.
- Dates are limited to the range JavaScript can represent. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/timestamp-converter/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
