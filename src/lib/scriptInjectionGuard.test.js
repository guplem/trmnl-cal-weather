// Guards the script-breakout fix in src/full.liquid.template. The polled values
// are injected inside backticks inside the one <script> block, and Liquid's
// `json` filter does not escape `<`, so an HTML error page containing
// `</script>` would end the script element and render the screen as garbled
// text. Each injection point therefore carries a Liquid `replace` chain.
//
// The chain is repeated by hand at every injection point and cannot live in a
// src/lib helper: the HTML parser acts before any JavaScript runs, so nothing
// on the JS side can repair a script element that already closed. These tests
// are the only automated proof that the chain is present and correct.
//
// The chain is a pure string transform, so it needs neither a Liquid engine nor
// a DOM and is not covered by the "Liquid render" test exemption in AGENTS.md.

import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeJson } from './jsonRecovery.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = readFileSync(join(ROOT, 'src', 'full.liquid.template'), 'utf8');

const BACKSLASH = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);
const DOLLAR = String.fromCharCode(36);

describe('every IDX injection point carries the escape chain', () => {
  const injections = TEMPLATE.match(/\{\{[^}]*IDX_[0-9][^}]*\}\}/g) || [];

  // Pinned so that adding a fourth polling URL fails here and forces the author
  // to give the new injection point the same chain.
  test('there are exactly six injection points', () => {
    expect(injections.length).toBe(6);
  });

  for (const injection of injections) {
    test('escapes < ` and ${ in ' + injection.slice(0, 48) + '...', () => {
      expect(injection).toContain(BACKSLASH + 'u003c'); // <
      expect(injection).toContain(BACKSLASH + 'u0060'); // backtick
      expect(injection).toContain(BACKSLASH + 'u0024{'); // ${
    });
  }
});

// Reproduces what the device does: Liquid renders the escaped text, the browser
// parses the HTML, then the JS template literal and JSON.parse read it back.
function renderThroughLiquid(value) {
  return JSON.stringify(value)
    .split('<').join(BACKSLASH + 'u003c')
    .split(BACKTICK).join(BACKSLASH + 'u0060')
    .split(DOLLAR + '{').join(BACKSLASH + 'u0024{');
}

function readBackInBrowser(rendered) {
  // eval is the only way to apply real template-literal escape processing.
  return JSON.parse(sanitizeJson(eval(BACKTICK + rendered + BACKTICK)));
}

describe('the escape chain is safe and lossless', () => {
  const cases = [
    ['a plain payload', { data: { events: [{ summary: 'Standup' }] } }],
    ['a Google HTML error page', 'Datei kann nicht <b>geoeffnet</b> werden</script><body>'],
    ['a literal </script> in an event title', { data: { events: [{ summary: 'Demo </script> talk' }] } }],
    ['an HTML comment opener', { note: '<!-- hidden -->' }],
    ['a backtick in a title', { note: 'use ' + BACKTICK + 'code' + BACKTICK + ' here' }],
    ['a template interpolation', { note: DOLLAR + '{alert(1)}' }],
    ['a newline in a description', { note: 'line one\nline two' }],
    ['a tab in a description', { note: 'a\tb' }],
    ['accented text', { note: 'Reunio a les 9 - cafe' }],
    ['an empty array', []],
  ];

  for (const [name, value] of cases) {
    test('hides every < from the HTML parser: ' + name, () => {
      expect(renderThroughLiquid(value)).not.toContain('<');
    });

    test('round-trips unchanged: ' + name, () => {
      expect(readBackInBrowser(renderThroughLiquid(value))).toEqual(value);
    });
  }

  // Without the chain the breakout is real; this proves the tests above are not
  // passing for a trivial reason.
  test('the unescaped text really does contain </script>', () => {
    expect(JSON.stringify('a</script>b')).toContain('</script>');
  });
});
