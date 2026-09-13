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
//
// Every replacement below is read out of the template itself, never restated
// here. A test that restated the chain would keep passing with the template's
// own chain deleted, reversed, or reordered.

import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeJson, parseLiquid } from './jsonRecovery.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = readFileSync(join(ROOT, 'src', 'full.liquid.template'), 'utf8');

const BACKSLASH = String.fromCharCode(92);
const BACKTICK = String.fromCharCode(96);
const DOLLAR = String.fromCharCode(36);

// Each dangerous character paired with the JavaScript unicode escape that must
// replace it. Order matters: it is the order the template applies them in.
const EXPECTED_CHAIN = [
  ['<', BACKSLASH + 'u003c'],
  [BACKTICK, BACKSLASH + 'u0060'],
  [DOLLAR + '{', BACKSLASH + 'u0024{'],
];

const injections = TEMPLATE.match(/\{\{[^}]*IDX_[0-9][^}]*\}\}/g) || [];

function replacementsIn(injection) {
  return [...injection.matchAll(/replace: '(.*?)', '(.*?)'/g)].map((m) => [m[1], m[2]]);
}

describe('every IDX injection point carries the escape chain', () => {
  // Pinned so that adding a fourth polling URL fails here and forces the author
  // to give the new injection point the same chain.
  test('there are exactly six injection points', () => {
    expect(injections.length).toBe(6);
  });

  for (const injection of injections) {
    // Compares the pairs, not just the characters, so a reversed chain
    // (`replace: '<', '<'`) or a reordered one fails here.
    test('replaces exactly the dangerous characters, in order, in ' + injection.slice(0, 44) + '...', () => {
      expect(replacementsIn(injection)).toEqual(EXPECTED_CHAIN);
    });
  }
});

// Reproduces what the device does, using the template's own replacements: Liquid
// renders the escaped text, the browser parses the HTML, then the JavaScript
// template literal and the parser read it back.
function renderThroughLiquid(injection, value) {
  let rendered = JSON.stringify(value);
  for (const [from, to] of replacementsIn(injection)) {
    rendered = rendered.split(from).join(to);
  }
  return rendered;
}

function readBackInBrowser(injection, rendered) {
  // eval is the only way to apply real template-literal escape processing.
  const afterTemplateLiteral = eval(BACKTICK + rendered + BACKTICK);
  // The three production points run the value through Liquid's `json` filter;
  // the three trmnlp fallbacks do not and are read back with parseLiquid.
  return injection.includes('| json')
    ? JSON.parse(sanitizeJson(afterTemplateLiteral))
    : parseLiquid(afterTemplateLiteral);
}

describe('the escape chain is safe and lossless at every injection point', () => {
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

  for (let i = 0; i < injections.length; i++) {
    const injection = injections[i];
    for (const [name, value] of cases) {
      test('point ' + i + ' hides every < from the HTML parser: ' + name, () => {
        expect(renderThroughLiquid(injection, value)).not.toContain('<');
      });

      test('point ' + i + ' round-trips unchanged: ' + name, () => {
        expect(readBackInBrowser(injection, renderThroughLiquid(injection, value))).toEqual(value);
      });
    }

    // A backslash directly before a `<` is a known defect: the template literal
    // eats it, so the value is corrupted. Pin the part that matters here, which
    // is that it is still not a breakout. The corruption has its own issue.
    test('point ' + i + ' stays safe when a backslash precedes a <', () => {
      expect(renderThroughLiquid(injection, { note: BACKSLASH + '<b>' })).not.toContain('<');
    });
  }

  // Without the chain the breakout is real; this proves the tests above are not
  // passing for a trivial reason.
  test('the unescaped text really does contain </script>', () => {
    expect(JSON.stringify('a</script>b')).toContain('</script>');
  });
});
