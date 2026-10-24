# Ideas and good first tasks

Pick something, open an issue to say so, and follow [CONTRIBUTING.md](../CONTRIBUTING.md). Difficulty guide: **J** = suitable for a junior engineer, **M** = mid-level.

## Improvements to existing tools

| Tool                | Task                                                              | Level |
| ------------------- | ----------------------------------------------------------------- | ----- |
| JSON / YAML / XML   | Multi-document YAML and a JSON Lines mode                         | M     |
| JSON / YAML / XML   | Convert to and from CSV for arrays of flat objects                | J     |
| Regex Tester        | Run matching in a Web Worker with a timeout and a Stop button     | M     |
| Regex Tester        | More Indian patterns (vehicle number, Aadhaar format check only)  | J     |
| Cron Explainer      | Daylight-saving aware zones                                       | M     |
| JWT & Base64        | PS256 and EdDSA verification                                      | M     |
| Diff Viewer         | Ignore blank lines, and a folder-name list compare                | J     |
| Timestamp Converter | Show a custom list of zones and remember it in a saved file       | J     |
| URL & Query Parser  | A button for resolving a relative link (core already supports it) | J     |
| Hash & UUID         | Hash several files at once and copy as `sha256sum` lines          | J     |
| Log Analyser        | Time-zone aware timestamps, and a custom log format pattern       | M     |
| Semver & Changelog  | Group by scope, and link issue numbers to a base URL              | J     |
| All                 | Translate tool text (an `i18n` helper in `shared/`)               | M     |
| All                 | Playwright smoke tests for each page in CI                        | M     |

## New tool candidates

| Idea                     | What it does                                         | Level |
| ------------------------ | ---------------------------------------------------- | ----- |
| Dockerfile / YAML linter | Flag common mistakes in Compose and Kubernetes files | M     |
| Env file comparer        | Compare two `.env` files and show missing keys       | J     |
| Chmod calculator         | Convert between `rwx` and octal permissions          | J     |
| SQL formatter            | Tidy a pasted query                                  | M     |
| CIDR calculator          | Ranges, masks and overlap checks                     | J     |
