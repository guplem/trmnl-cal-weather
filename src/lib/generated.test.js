// Drift guard for the build step. `src/lib/*.js` is the single source; the
// committed `src/full.liquid` and `src/middleware/calendar_weather_proxy.gs`
// are generated from it by build.mjs. This test regenerates them in memory and
// fails if a committed file differs, so editing a generated file directly or
// forgetting to run `bun run build` breaks CI. EOL is normalized so the check
// does not depend on CRLF vs LF checkouts.

import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTargets } from '../../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const normalizeEol = (text) => text.replace(/\r\n/g, '\n');

for (const target of buildTargets()) {
  test(`committed ${target.out} matches build.mjs output (run \`bun run build\` after editing src/lib)`, () => {
    const committed = readFileSync(join(ROOT, target.out), 'utf8');
    expect(normalizeEol(committed)).toBe(normalizeEol(target.content));
  });
}
