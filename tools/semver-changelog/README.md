# Semver & Changelog Helper

> Compare and bump versions, and turn Conventional Commit lines into release notes.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter the current version to see every kind of bump. Test a version range such as `^1.2.0 || >=3` against a list of versions, or sort the list. Paste commit messages (for example `git log --oneline`) and get a suggested next version and release notes in Markdown, grouped into breaking changes, features and fixes.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/semver-changelog/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- semver-changelog ../semver-changelog-repo`.

## Features

- Semver 2.0.0 parsing and ordering, including pre-release rules.
- Bump: major, minor, patch and the pre- variants with a label.
- npm-style ranges: `^`, `~`, x-ranges, comparators, hyphen ranges and `||`, explained in words.
- Conventional Commits: type, scope, `!` and `BREAKING CHANGE`, issue numbers; suggests major, minor or patch.
- Markdown release notes: copy or download.

## How it works

`js/core.js` exports `SemverCore`: `parse`, `valid`, `compare`, `sort`, `diff`, `bump`, `parseRange`, `satisfies`, `filter`, `explainRange`, `parseCommit`, `release`, `markdown` and `sample`.

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

- Range rules follow the npm convention; other ecosystems (Maven, Python) differ.
- Only commits written in the Conventional Commits form are counted; others are listed as skipped.
- The suggested version is a starting point: you decide the release. Before 1.0.0 a breaking change raises the minor number. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/semver-changelog/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
