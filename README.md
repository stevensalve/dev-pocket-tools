# Dev Pocket Tools

**Ten small, private tools for engineers that run in your browser and keep working with no internet.**
Format and convert JSON, YAML and XML, test regular expressions, explain cron schedules, decode JWTs and Base64, diff two texts, convert timestamps, take URLs apart, hash files and generate UUIDs, analyse a log, and draft release notes - without pasting tokens, configs or logs into someone else's website. Built for India: IST alongside UTC, DD/MM/YYYY dates, Indian ID patterns in the regex library.

- **Private** - everything runs on your own computer. Nothing is uploaded, tracked or stored remotely.
- **Offline** - download once, use forever. No installation, no account, no subscription.
- **Simple** - plain HTML, CSS and JavaScript. No framework, no build step, nothing to break.
- **Open** - MIT licensed. Copy a tool, change it, share it.

> New here and not a developer? Jump to [Use it without any technical knowledge](#use-it-without-any-technical-knowledge).
>
> These are convenience tools, not security products. Pasted text (tokens, keys, logs) stays in the browser tab, but do not paste production secrets on a shared or untrusted computer. The regex tester cannot interrupt a catastrophic pattern (it only warns), cron times use fixed offsets without daylight saving, a decoded JWT is not trusted unless you verify it, and MD5 and SHA-1 are only for checking old checksums. Check anything important before you rely on it.

## The ten tools

Each tool lives in its own self-contained folder under [`tools/`](tools/) with its own README, license and tests. Any folder can be copied, hosted or published on its own.

| #   | Tool                                                 | What it does                                                                                 | Replaces              |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------- |
| 1   | [JSON / YAML / XML Converter](tools/json-yaml-xml/)  | Format, validate and convert between the three, with line and column errors and a path query | online formatters     |
| 2   | [Regex Tester](tools/regex-tester/)                  | Live highlights, groups, replace, explainer and ready patterns (PAN, GSTIN, IFSC...)         | regex sites           |
| 3   | [Cron Explainer](tools/cron-explainer/)              | Plain-English meaning and next run times in IST and UTC                                      | cron websites         |
| 4   | [JWT & Base64 Decoder](tools/jwt-base64/)            | Decode tokens and check expiry; optional signature check; Base64, URL and hex                | online decoders       |
| 5   | [Diff Viewer](tools/diff-viewer/)                    | Side-by-side and unified diff with word highlights                                           | diff sites            |
| 6   | [Timestamp Converter](tools/timestamp-converter/)    | Unix time, ISO and plain dates across zones, with relative time                              | epoch converters      |
| 7   | [URL & Query Parser](tools/url-parser/)              | Split, edit and rebuild links; strip tracking parameters                                     | url tools             |
| 8   | [Hash & UUID Generator](tools/hash-uuid/)            | File and text hashes, checksum check, HMAC, UUID v4 and v7                                   | hash sites            |
| 9   | [Log Analyser](tools/log-analyser/)                  | Levels, repeated errors, busiest minutes, filter and CSV                                     | grep and spreadsheets |
| 10  | [Semver & Changelog Helper](tools/semver-changelog/) | Bump and compare versions, test ranges, release notes from commits                           | release notes by hand |

The launcher page ([`index.html`](index.html)) lists all ten with a search box.

## Use it without any technical knowledge

1. On the GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip the file anywhere (Desktop, Documents, a USB stick).
3. Open the unzipped folder and double-click **`index.html`**. Choose a tool.

That's all. You can disconnect from the internet and everything still works. Want just one tool? Copy only its folder from `tools/` and double-click that folder's `index.html`.

Works in current versions of Chrome, Edge, Firefox and Safari (16.4 or newer).

## For developers

Requirements: [Node.js](https://nodejs.org) 22 or newer (only for tests and tooling - the tools themselves need no Node).

```bash
git clone <this-repository-url>
cd dev-pocket-tools
npm install          # dev tooling only: tests, lint, formatter, library copies
npm run serve        # http://localhost:8080  (or just open index.html)
npm test             # unit tests for every tool
npm run verify       # everything CI runs: sync check, structure check, offline check, lint, format, tests
```

Useful commands:

| Command                                                      | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `npm run serve`                                              | Local static server (zero dependencies)                         |
| `npm test`                                                   | Run all unit tests (Node's built-in test runner)                |
| `npm run lint` / `npm run format`                            | ESLint / Prettier                                               |
| `npm run sync`                                               | Copy `shared/` files into each tool (`check:sync` verifies)     |
| `npm run vendor`                                             | Refresh bundled third-party libraries from `node_modules`       |
| `npm run check:offline`                                      | Fail if any page loads something from the internet              |
| `npm run check:structure`                                    | Enforce conventions (required files, README sections, CSP, ...) |
| `npm run build`                                              | Assemble the deployable site in `_site/`                        |
| `npm run new-tool -- my-tool "My Tool" "What it does"`       | Scaffold an eleventh tool                                       |
| `npm run export-tool -- json-yaml-xml ../json-yaml-xml-repo` | Turn one tool into its own repository                           |

### Repository layout

```text
.
├── index.html               Launcher page (search + links to all tools)
├── tools/
│   └── <tool>/              One self-contained folder per tool
│       ├── index.html       Page + Content-Security-Policy
│       ├── css/             theme.css (synced) + app.css (tool-specific)
│       ├── js/              common.js (synced) + core.js (logic) + app.js (UI)
│       ├── vendor/          Bundled third-party libraries + README with versions
│       ├── tests/           Unit tests (node:test)
│       ├── README.md        User and developer documentation
│       └── LICENSE
├── shared/                  Single source for theme.css and common.js (+ tests)
├── site/                    Launcher page code and tool catalogue
├── templates/tool/          Starter files used by `npm run new-tool`
├── scripts/                 Zero-dependency Node scripts (sync, vendor, checks, build)
├── docs/                    Architecture, hosting, adding a tool, splitting a tool
└── .github/                 CI, GitHub Pages deploy, issue and PR templates, Dependabot
```

### How the code is organised (the short version)

Every tool follows the same three-layer pattern, so once you have read one you can read all ten:

1. **`core.js` - the logic.** Pure functions with no access to the page, so they run in Node and are unit-tested. They throw plain-language `Error`s for bad input.
2. **`app.js` - the user interface.** Reads the form, calls `core.js`, shows results and errors. Builds the page with `textContent` / DOM APIs (never `innerHTML` with user data).
3. **`index.html` + CSS** - semantic, accessible markup with a strict Content-Security-Policy.

Scripts are classic `<script>` files (not ES modules) on purpose: browsers block module loading from `file://`, and double-click-to-open is a core feature. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning.

## Hosting

Because there is no build step, hosting is just "serve these files".

- **GitHub Pages** (included): in your repository go to _Settings -> Pages -> Build and deployment -> Source: GitHub Actions_. The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`.
- **Any static host** (Netlify, Cloudflare Pages, an intranet web server, a shared network drive): upload the output of `npm run build` (the `_site/` folder) or the repository itself.

Details and tips (including hosting inside a company network): [docs/HOSTING.md](docs/HOSTING.md).

## Privacy and security by design

- Every page has a Content-Security-Policy that blocks network requests (`connect-src 'none'`), inline scripts and `eval`. `npm run check:offline` and `npm run check:structure` guard this in CI.
- Third-party libraries are copied into each tool's `vendor/` folder (no CDN), with versions and licenses recorded.
- No analytics, cookies, fonts or images are loaded from anywhere.
- Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome at every level - fixing a typo, adding a test, improving accessibility, or building a new tool. Start with [CONTRIBUTING.md](CONTRIBUTING.md); [docs/IDEAS.md](docs/IDEAS.md) lists beginner-friendly and intermediate tasks. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Bundled third-party libraries keep their own licenses (listed in each tool's `vendor/README.md`): js-yaml (MIT) and fast-xml-parser (MIT), used only by the JSON / YAML / XML Converter. The other nine tools bundle no third-party code.
