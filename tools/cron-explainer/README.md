# Cron Explainer

> Explain a cron expression in plain English and list the next run times.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Type a five-field cron expression, or a macro such as `@daily`, and get a plain-English sentence, a field-by-field breakdown and the next run times shown in IST and UTC. Presets cover common schedules.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/cron-explainer/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- cron-explainer ../cron-explainer-repo`.

## Features

- Five-field cron with lists, ranges, steps, month and day names, and `@hourly` to `@yearly` macros.
- Next 10 run times in IST, UTC or another fixed offset.
- Follows the standard rule: when both day-of-month and day-of-week are set, either may match.
- Warnings for the day-of-month plus day-of-week rule and for days (29 to 31) that do not exist in every month.
- Ten presets and copy buttons.

## How it works

`js/core.js` exports `CronCore`: `MONTHS`, `DAYS`, `PRESETS`, `parse`, `explain`, `warnings`, `next` and `shift`.

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

- Quartz and Spring extensions (`L`, `W`, `#`, seconds and year fields) are rejected, not guessed.
- Times are computed on the wall clock of a fixed UTC offset. Zones with daylight saving are not modelled, so check the server time zone of your scheduler.
- Different cron implementations differ in small ways (for example how `*/7` restarts each hour). Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/cron-explainer/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
