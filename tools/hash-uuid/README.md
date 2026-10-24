# Hash & UUID Generator

> Hash text or files (SHA-1, SHA-256, SHA-384, SHA-512), verify a checksum and generate UUIDs.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Drop a file or type text to get MD5, SHA-1, SHA-256, SHA-384 and SHA-512 digests. Paste the checksum you were given and the tool tells you whether it matches. It also computes HMACs and generates and inspects UUIDs (versions 4 and 7).

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/hash-uuid/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- hash-uuid ../hash-uuid-repo`.

## Features

- Files up to 200 MB are hashed in the browser and never uploaded.
- Checksum check that accepts common formats (`sha256sum` output, `SHA256:` prefix, spaces, upper case) and explains a mismatch in length.
- HMAC with SHA-1, 256, 384 or 512.
- UUID v4 and v7 in bulk, with upper-case, no-dash and brace options; inspect version, variant and the time inside a v7 or v1.
- MD5 verified against the RFC 1321 test suite.

## How it works

`js/core.js` exports `HashCore`: `ALGOS`, `md5`, `digest`, `hashText`, `hmac`, `cleanChecksum`, `compare`, `uuid`, `uuids` and `inspect`. Web Crypto, randomness and the clock are passed in.

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

- MD5 and SHA-1 are broken for security use; they are there to check old checksums only.
- Files are read into memory: up to 200 MB. For larger files use `sha256sum` or `Get-FileHash`.
- A matching hash proves the file equals the one the checksum was made from; it does not prove that the checksum itself came from a trusted source. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/hash-uuid/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
