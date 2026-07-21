# Pure helpers in `src/lib` as the single source, inlined into the generated template and `.gs` by a build step

## Context

The plugin's pure logic runs inline in two places a test runner cannot import: the browser JS embedded in `src/full.liquid` (a Liquid template pasted into TRMNL), and `src/middleware/calendar_weather_proxy.gs` (Google Apps Script, which runs only on Google's servers). The personal standard mandates red-green TDD for testable logic. The first cut of this ADR extracted the helpers into `src/lib/` but kept a hand-maintained inline copy in each of those files, so the same function existed twice and the two copies could silently drift.

## Decision

`src/lib/*.js` holds the **only** hand-edited copy of the pure helpers, each with a `bun test` suite. A build step inlines them into the shipped files, so there is no second copy to keep in sync.

- **Single source:** `src/lib/` modules stay pure, typed (JSDoc), and tested.
  - From the template: `toMin`, `layoutOverlaps` (`eventLayout.js`); `dayInfo`, `calKey` (`dateLabels.js`); `compileIgnoredPhrases`, `isIgnoredEvent` (`ignoredEvents.js`); `sanitizeJson`, `parseLiquid`, `hasCalData`, `deepParse` (`jsonRecovery.js`); `wIcon` (`weatherIcon.js`).
  - From the middleware: `cleanText`, `cacheKey`, `forecastUrl` (`middleware.js`).
- **Templates with a marker:** `src/full.liquid.template` and `src/middleware/calendar_weather_proxy.gs.template` are the hand-edited shells. Each has one `@generated:helpers` marker where the helpers are inlined; everything else is authored there.
- **Build step:** `build.mjs` (run with `bun run build`) reads each template, replaces the marker with the concatenated `src/lib` source (stripped of `export`/`import` so it is plain in-scope JS/GS), and writes the committed, ready-to-paste `src/full.liquid` and `.gs`. Each generated file carries a "GENERATED - do not edit" banner.
- **Signature-preserving wrappers:** two helpers closed over an outer value in the original inline code. The build emits the pure function under a `*Pure` name plus a thin wrapper that restores the original call site, so no call site in the template or `.gs` changes:
  - `isIgnoredEvent(ev)` -> `isIgnoredEventPure(ev, ignoredPhrases)` + `function isIgnoredEvent(ev){ return isIgnoredEventPure(ev, IGNORED_PHRASES); }`
  - `cleanText(text)` -> `cleanTextPure(text, maxTextLength)` + `function cleanText(text){ return cleanTextPure(text, CONFIG.maxTextLength); }`
- **Drift gate:** `src/lib/generated.test.js` regenerates both files in memory and fails if a committed file differs (EOL-normalized). `bun test .` runs it, so CI blocks any PR where a generated file was hand-edited or the author forgot to run `bun run build`.

The exempt layers keep their non-unit safety net: the Liquid render and DOM-building glue in `full.liquid`, and the Google-service calls in the `.gs` (`CalendarApp`, `CacheService`, `UrlFetchApp`), are verified by the local `trmnlp serve` visual run and the on-screen diagnostic overlay.

**Rejected alternative:** keep a hand-maintained inline copy in each shipped file and rely on a written "keep in sync" rule (the previous version of this ADR). Rejected because the two copies drift silently: a change to one that the test does not see leaves the live copy wrong. The build step removes the second copy entirely, and the drift test enforces it, for the cost of one small dependency-free script.

## Consequences

**Positive:**

- One tested source of truth. The generated files cannot drift from `src/lib`: the drift test fails if they do.
- Call sites are untouched, so the shipped runtime behavior is identical to the hand-written original (wrappers restore the two changed signatures).
- The exempt UI/service layers are still honestly marked and covered by visual/diagnostic checks, not fake unit tests.

**Trade-offs and follow-up:**

- Deploying now has one extra step: run `bun run build`, then paste the generated `src/full.liquid` / `.gs` (never edit those directly). The pre-commit hook regenerates and stages them; the drift test is the backstop.
- A helper that is genuinely not pure (closes over template/`.gs` state) needs a wrapper in `build.mjs`, as `isIgnoredEvent` and `cleanText` do.
