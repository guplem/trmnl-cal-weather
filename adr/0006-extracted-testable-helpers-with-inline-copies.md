# Pure helpers extracted to `src/lib` as the tested source of truth, with in-sync inline copies

## Context

The plugin's pure logic lives inline in two places that cannot be imported by a test runner: the browser JS embedded in `src/full.liquid` (a Liquid template), and `src/middleware/calendar_weather_proxy.gs` (Google Apps Script, which runs only on Google's servers). There is no build step and no bundler, and adding one to rewire the template into imported modules would risk the live display. The personal standard still mandates red-green TDD for testable logic.

## Decision

Copy the genuinely pure, self-contained helpers into plain ES modules under `src/lib/`, each with a `bun test` suite, and treat `src/lib/` as the tested source of truth.

- Extracted from `full.liquid`: `toMin`, `layoutOverlaps` (`eventLayout.js`); `dayInfo`, `calKey` (`dateLabels.js`); `compileIgnoredPhrases`, `isIgnoredEvent` (`ignoredEvents.js`); `sanitizeJson`, `parseLiquid`, `hasCalData`, `deepParse` (`jsonRecovery.js`); `wIcon` (`weatherIcon.js`).
- Extracted from the `.gs`: `cleanText`, `cacheKey`, `forecastUrl` (`middleware.js`).
- Where the inline original closed over an outer value, the extracted version takes it as a parameter so the module is pure: `isIgnoredEvent(ev, ignoredPhrases)` and `cleanText(text, maxTextLength)`. Behavior is otherwise identical to the inline original.
- **The inline copy and the `src/lib` copy must stay in sync.** When either changes, both change and stay behavior-identical. Nothing enforces this at runtime (no build step); the test suite plus this rule and the `src/AGENTS.md`/`src/middleware/AGENTS.md` gotchas are the guard.

The exempt layers get a different safety net: the Liquid render and DOM-building glue in `full.liquid`, and the Google-service calls in the `.gs` (`CalendarApp`, `CacheService`, `UrlFetchApp`), are verified by the local `trmnlp serve` visual run and the on-screen diagnostic overlay, not by unit tests.

**Rejected alternative:** a build step that bundles `src/lib` into `full.liquid` (single source, no duplication). Rejected because it adds tooling this no-build plugin deliberately avoids and risks breaking the live paste-in template; the duplication is small and covered by tests plus explicit sync rules.

## Consequences

**Positive:**

- The pure logic has a real red-green test gate (`bun test .`) that CI enforces, without touching how the template or the `.gs` ship.
- The exempt UI/service layers are honestly marked and covered by visual/diagnostic checks instead of fake unit tests.

**Trade-offs and follow-up:**

- Two copies of each helper can drift. A change that edits one and not the other passes CI (the test only sees `src/lib`) while the live copy is wrong. Always edit both; a future build step (the rejected alternative) is the only way to remove the duplication.
