# JWT & Base64 Decoder

> Decode JWTs, Base64 and URL-encoded text locally, and check expiry. Never sends a token anywhere.

Part of [Dev Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Paste a JSON Web Token to see its header, payload and claims, with the issued, not-before and expiry times in UTC and IST and a clear expired or valid verdict. The same page encodes and decodes Base64 (standard and URL-safe), percent-encoding and hex.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/jwt-base64/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- jwt-base64 ../jwt-base64-repo`.

## Features

- JWT decode with claim explanations and expiry status.
- Optional signature check for HS256/384/512 (secret), RS256/384/512 and ES256/384 (PEM public key) using the browser Web Crypto.
- Warnings for `alg: none`, missing expiry and very long lifetimes.
- Base64, Base64URL, URL and hex conversion with UTF-8 handling, and format detection.
- Sample token.

## How it works

`js/core.js` exports `JwtCore`: `b64encode`, `b64decode`, `urlEncode`, `urlDecode`, `hexEncode`, `hexDecode`, `detect`, `formatTime`, `decodeJwt`, `verify` and `sampleToken`. Web Crypto is passed in as `subtle`.

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
- A JWT is a credential. Decoding does not need the secret and nothing is sent anywhere, but treat tokens you paste as sensitive and clear the page afterwards.

## Limitations

- A token is only decoded unless you supply a key; an unverified payload must not be trusted.
- Signature check needs a secure context (the page opened from disk or over https) and supports the listed algorithms only; EdDSA and PS256 are not supported.
- Encrypted tokens (JWE) are not decrypted. Check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/jwt-base64/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
