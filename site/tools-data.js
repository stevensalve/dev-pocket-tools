/**
 * The catalogue shown on the launcher page (index.html).
 * Keep in sync with the folders in /tools - `npm run check:structure` fails if
 * a tool is missing here. It is a .js file (not .json) so the launcher also
 * works when opened straight from disk, where browsers block fetch().
 */
window.TOOLS = [
  {
    id: 'json-yaml-xml',
    title: 'JSON / YAML / XML Converter',
    tagline: 'Format, validate and convert between JSON, YAML and XML, and query with a path.',
    replaces: 'online formatters',
    tags: ['json', 'yaml', 'xml', 'format', 'convert'],
  },
  {
    id: 'regex-tester',
    title: 'Regex Tester',
    tagline: 'Test a regular expression against text with live highlights, groups, replace and a plain-English cheat sheet.',
    replaces: 'regex sites',
    tags: ['regex', 'regexp', 'match', 'replace'],
  },
  {
    id: 'cron-explainer',
    title: 'Cron Explainer',
    tagline: 'Explain a cron expression in plain English and list the next run times.',
    replaces: 'cron websites',
    tags: ['cron', 'schedule', 'crontab'],
  },
  {
    id: 'jwt-base64',
    title: 'JWT & Base64 Decoder',
    tagline: 'Decode JWTs, Base64 and URL-encoded text locally, and check expiry. Never sends a token anywhere.',
    replaces: 'online decoders',
    tags: ['jwt', 'base64', 'decode', 'token'],
  },
  {
    id: 'diff-viewer',
    title: 'Diff Viewer',
    tagline: 'Compare two texts or files line by line, with word-level highlights and a unified diff export.',
    replaces: 'diff sites',
    tags: ['diff', 'compare', 'patch'],
  },
  {
    id: 'timestamp-converter',
    title: 'Timestamp Converter',
    tagline: 'Convert Unix timestamps and dates between UTC, IST and other zones, with relative time.',
    replaces: 'epoch converters',
    tags: ['epoch', 'unix', 'timestamp', 'timezone'],
  },
  {
    id: 'url-parser',
    title: 'URL & Query Parser',
    tagline: 'Split a URL into parts, edit its query parameters, and encode or decode values.',
    replaces: 'url tools',
    tags: ['url', 'query', 'encode', 'params'],
  },
  {
    id: 'hash-uuid',
    title: 'Hash & UUID Generator',
    tagline: 'Hash text or files (SHA-1, SHA-256, SHA-384, SHA-512), verify a checksum and generate UUIDs.',
    replaces: 'hash sites',
    tags: ['hash', 'sha', 'checksum', 'uuid'],
  },
  {
    id: 'log-analyser',
    title: 'Log Analyser',
    tagline: 'Paste log lines and see levels, top repeated errors, busiest minutes and a filter.',
    replaces: 'grep and spreadsheets',
    tags: ['log', 'error', 'grep', 'analyse'],
  },
  {
    id: 'semver-changelog',
    title: 'Semver & Changelog Helper',
    tagline: 'Compare and bump versions, and turn Conventional Commit lines into release notes.',
    replaces: 'release notes by hand',
    tags: ['semver', 'version', 'changelog', 'release'],
  },
];
