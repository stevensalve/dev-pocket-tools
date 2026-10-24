# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's private vulnerability reporting: on the repository page choose _Security -> Report a vulnerability_. Include the tool name, what you did, what you expected and what happened, and (if possible) a small file that reproduces it. We aim to acknowledge reports within a few days and to publish a fix and credit you (if you wish) once it is released.

## Supported versions

Only the latest release on the `main` branch is supported.

## Threat model in one paragraph

These tools process files that users open on their own computer. The main risks are (1) a malicious file exploiting a parser, (2) a bug leaking data over the network, and (3) tampered third-party code. The design answers each: parsers are well-known open-source libraries pinned to exact versions and bundled in `vendor/`; every page ships a Content-Security-Policy with `connect-src 'none'` plus `script-src 'self'` (no inline scripts, no `eval`) and CI fails if a page references an external resource; and libraries are never loaded from a CDN.

## Notes for specific components

- **Pasted secrets.** JWTs, API keys, signing secrets, URLs with tokens and logs are processed in the page only. Nothing is uploaded or stored, and the content is gone when the tab is closed or reloaded, but anything you copy or download is an ordinary file or clipboard entry. Do not paste production secrets on a shared or untrusted computer.
- **JWT decoding is not trust.** Decoding shows what a token claims; it does not prove who issued it. The tool only reports a signature as valid when you supply the key and the check succeeds. The `none` algorithm is flagged.
- **XML.** Documents with a `DOCTYPE` are rejected on purpose to avoid entity-expansion attacks. YAML custom tags are not executed (js-yaml is used in safe mode).
- **Regular expressions.** A catastrophic pattern can freeze the tab: this is a denial of service against yourself, not a data leak. Input size and match count are capped and risky shapes are flagged, but it cannot be interrupted.
- **Hashes.** MD5 and SHA-1 are provided to check legacy checksums only.
- **CSV exports** guard against formula injection (cells starting with `=`, `+`, `-` or `@` are prefixed with an apostrophe).
- **Defaults and formulas** (sample data, size limits, tracking-parameter list) are simple, documented choices, not advice. Wrong results are a correctness problem rather than a vulnerability, but please report them as bugs.

## Known `npm audit` findings

Run `npm audit` after installing. At the time of writing `npm audit` reports no findings. The two bundled libraries (js-yaml 5.5.0 and fast-xml-parser 5.11.2) are the latest releases at the time of writing, pinned to exact versions, and recorded in `tools/json-yaml-xml/vendor/README.md`. Earlier versions of both had advisories, so keep them updated. Re-check whenever dependencies are updated.

## What is out of scope

- Attacks that require the attacker to already control the user's browser or operating system.
- Signature checking is a convenience; it is not a replacement for verifying tokens in your server code.
