// Single-source build step. `src/lib/*.js` holds the only hand-edited copy of
// the pure helpers; this script inlines them into the committed, ready-to-paste
// `src/full.liquid` and `src/middleware/calendar_weather_proxy.gs`.
//
// For each target it reads the matching `*.template`, replaces the single
// `@generated:helpers` marker with the concatenated helper source, and prepends
// a "generated file" banner. The two helpers that closed over an outer value in
// the original inline code (`isIgnoredEvent`, `cleanText`) are emitted as a pure
// `*Pure` function plus a thin wrapper that restores the original call-site
// signature, so no call site in the template or the .gs has to change.
//
// Run: `bun run build`. A drift test (src/lib/generated.test.js) fails CI if a
// committed generated file does not match this script's output.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MARKER = '@generated:helpers';

function normalizeEol(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

// Turn a `src/lib` ES module into plain in-scope source: drop the leading
// banner comment and blank lines, drop `import` lines, and remove the `export`
// keyword. The per-function JSDoc is kept.
function stripModule(source) {
  const lines = normalizeEol(source).split('\n');
  let start = 0;
  while (start < lines.length && (lines[start].trim() === '' || lines[start].trimStart().startsWith('//'))) {
    start += 1;
  }
  return lines
    .slice(start)
    .filter((line) => !/^\s*import\b/.test(line))
    .map((line) => line.replace(/^(\s*)export\s+/, '$1'))
    .join('\n')
    .trim();
}

function readModule(relativePath) {
  return stripModule(readFileSync(join(ROOT, relativePath), 'utf8'));
}

// Helpers inlined into `src/full.liquid` (the browser JS inside the template).
function fullLiquidHelpers() {
  const eventLayout = readModule('src/lib/eventLayout.js');
  const dateLabels = readModule('src/lib/dateLabels.js');
  const ignored = readModule('src/lib/ignoredEvents.js')
    .replace('function isIgnoredEvent(', 'function isIgnoredEventPure(') +
    '\n\n' +
    '// Wrapper preserving the original inline signature isIgnoredEvent(ev): it\n' +
    '// binds the pure matcher to the IGNORED_PHRASES compiled in this scope.\n' +
    'function isIgnoredEvent(ev) { return isIgnoredEventPure(ev, IGNORED_PHRASES); }';
  const jsonRecovery = readModule('src/lib/jsonRecovery.js');
  const weatherIcon = readModule('src/lib/weatherIcon.js');
  return [eventLayout, dateLabels, ignored, jsonRecovery, weatherIcon].join('\n\n');
}

// Helpers inlined into the Apps Script middleware `.gs`.
function gsHelpers() {
  return readModule('src/lib/middleware.js')
    .replace('function cleanText(', 'function cleanTextPure(') +
    '\n\n' +
    '// Wrapper preserving the original inline signature cleanText(text): it\n' +
    '// reads CONFIG.maxTextLength like the original inline definition did.\n' +
    'function cleanText(text) { return cleanTextPure(text, CONFIG.maxTextLength); }';
}

function indentBlock(block, indent) {
  return block
    .split('\n')
    .map((line) => (line.length ? indent + line : line))
    .join('\n');
}

function render(templatePath, helpers, banner) {
  const raw = readFileSync(join(ROOT, templatePath), 'utf8');
  const eol = detectEol(raw);
  const lines = normalizeEol(raw).split('\n');
  const markerLines = lines.filter((line) => line.includes(MARKER));
  if (markerLines.length !== 1) {
    throw new Error(`expected exactly one ${MARKER} marker in ${templatePath}, found ${markerLines.length}`);
  }
  const markerIndex = lines.findIndex((line) => line.includes(MARKER));
  const markerIndent = lines[markerIndex].match(/^\s*/)[0];
  lines[markerIndex] = indentBlock(helpers, markerIndent);
  return [banner, ...lines].join('\n').replace(/\n/g, eol);
}

const TARGETS = [
  {
    template: 'src/full.liquid.template',
    out: 'src/full.liquid',
    helpers: fullLiquidHelpers(),
    banner: '{% comment %} GENERATED FILE - do not edit directly. Edit src/lib/*.js and src/full.liquid.template, then run `bun run build`. {% endcomment %}',
  },
  {
    template: 'src/middleware/calendar_weather_proxy.gs.template',
    out: 'src/middleware/calendar_weather_proxy.gs',
    helpers: gsHelpers(),
    banner: '// GENERATED FILE - do not edit directly. Edit src/lib/middleware.js and src/middleware/calendar_weather_proxy.gs.template, then run `bun run build`.',
  },
];

// Exposed so the drift test can compare committed files against fresh output
// without shelling out or writing to disk.
export function buildTargets() {
  return TARGETS.map((target) => ({
    out: target.out,
    content: render(target.template, target.helpers, target.banner),
  }));
}

function main() {
  for (const target of buildTargets()) {
    writeFileSync(join(ROOT, target.out), target.content);
    console.log(`generated ${target.out}`);
  }
}

if (import.meta.main) main();
