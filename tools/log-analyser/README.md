# Log Analyser

> Paste log lines and see levels, top repeated errors, busiest minutes and a filter.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Paste or drop a log file. The tool recognises each entry, counts them by level, finds the minute or hour with the most traffic and errors, and groups repeated problems together by ignoring the numbers and IDs in them. A filter narrows the lines by level or text and exports the matches as CSV.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/log-analyser/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- log-analyser ../log-analyser-repo`.

## Features

- Reads JSON lines, logfmt, nginx/Apache access logs and common `date LEVEL message` layouts.
- Stack-trace lines stay attached to the entry above them.
- Counts by level, error rate, timeline per minute, hour or day.
- Top problems with first and last time seen; for access logs, status classes, busiest paths, failing paths, top clients and slowest requests.
- Filter by level, text or regular expression; CSV (Excel-safe) and copy summary.

## How it works

`js/core.js` exports `LogCore`: `LEVELS`, `parseLine`, `parse`, `pattern`, `analyse`, `filter`, `toCsv`, `toText` and `sample`.

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
- Logs often contain customer data, IP addresses and secrets. Nothing is sent anywhere, but do not leave a sensitive log open on a shared computer.

## Limitations

- Times without a zone are used as written, so a log mixing time zones will show them side by side without correcting them.
- Files over 20 MB, or more than 300,000 lines, are not read: paste a slice.
- Format detection is by pattern. Unusual layouts may show up as unknown level or be attached to the entry above. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/log-analyser/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
