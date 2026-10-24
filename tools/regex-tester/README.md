# Regex Tester

> Test a regular expression against text with live highlights, groups, replace and a plain-English cheat sheet.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Type a pattern and some sample text. Matches are highlighted as you type, with the position and capture groups of each one. A replace box shows the result of a substitution, and a plain-English breakdown explains each part of the pattern. A library of ready patterns covers Indian mobile numbers, PAN, GSTIN, PIN codes, IFSC codes, dates and more.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/regex-tester/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- regex-tester ../regex-tester-repo`.

## Features

- JavaScript regular expressions with the g, i, m, s, u and y flags.
- Highlighted matches, numbered and named groups with indices.
- Replace with `$1` and `$<name>` references.
- Pattern explainer and warnings for nested quantifiers that can run very slowly.
- Snippet library (each snippet is unit-tested) and a sample.

## How it works

`js/core.js` exports `RegexCore`: `FLAGS`, `compile`, `warnings`, `run`, `segments`, `replace`, `explain`, `SNIPPETS` and `sample`.

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

- It uses the JavaScript engine of your browser. Other languages (Python, Java, PCRE) differ in lookbehind, named group syntax and flags.
- A catastrophic pattern can freeze the tab, and a page cannot interrupt it. The tool warns about common risky shapes and caps the text at 200,000 characters and the matches at 1,000, but the warning is a heuristic, not a guarantee. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/regex-tester/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
