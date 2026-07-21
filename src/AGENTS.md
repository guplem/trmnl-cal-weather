# Template area (`src/`)

The Liquid template that TRMNL renders. **`full.liquid` is a generated file** (do not edit it): `full.liquid.template` is the hand-edited shell, and `bun run build` inlines the `src/lib` helpers into it. Its JS parses the polled JSON and builds the weekly time-grid DOM. `half_horizontal.liquid`, `half_vertical.liquid`, and `quadrant.liquid` are "full view only" stubs (see ADR 0003). `settings.yml` and `form_fields.yml` are the plugin config. The middleware that feeds the template has its own area doc in `src/middleware/AGENTS.md`.

Repo-wide conventions, the ADR index, and the Git workflow live in the root `AGENTS.md`; this file holds only what is specific to the template.

## Pure helpers: single source in `src/lib/`, inlined by the build

`src/lib/*.js` is the only hand-edited copy of the pure helpers and the tested source of truth. `build.mjs` (run `bun run build`) inlines them into the committed `full.liquid` at the `@generated:helpers` marker in `full.liquid.template`. There is no second copy to keep in sync; the drift test enforces it (ADR 0006).

| `src/lib/` module | Functions | Inlined into |
|---|---|---|
| `eventLayout.js` | `toMin`, `layoutOverlaps` | `full.liquid` |
| `dateLabels.js` | `dayInfo`, `calKey` | `full.liquid` |
| `ignoredEvents.js` | `compileIgnoredPhrases`, `isIgnoredEvent` | `full.liquid` |
| `jsonRecovery.js` | `sanitizeJson`, `parseLiquid`, `hasCalData`, `deepParse` | `full.liquid` |
| `weatherIcon.js` | `wIcon` | `full.liquid` |
| `middleware.js` | `cleanText`, `cacheKey`, `forecastUrl` | `src/middleware/calendar_weather_proxy.gs` |

`isIgnoredEvent` takes its compiled-phrases array as a parameter so the module is pure. The build emits it as `isIgnoredEventPure` plus a wrapper `isIgnoredEvent(ev)` that binds `IGNORED_PHRASES`, so the template's call sites are unchanged. (`cleanText` gets the same treatment in the `.gs`; see `src/middleware/AGENTS.md`.)

## Gotchas

- **`full.liquid` is generated; never edit it directly (critical).** Edit `src/lib/*.js` (and its `*.test.js`) or `full.liquid.template`, then run `bun run build`. The drift test (`src/lib/generated.test.js`) fails CI if the committed `full.liquid` is stale or hand-edited. See ADR 0006.
- **The helper block lives at the `@generated:helpers` marker in `full.liquid.template`.** Everything outside the marker (config, parse flow, DOM building, the `IGNORED_PHRASES` compile call, non-pure helpers like `esc`/`deepParseWeather`) is authored in the template.
- TRMNL framework wraps content in `.screen > .view > .layout` divs that add padding. Override with `padding: 0 !important`.
- `.layout--row` needs explicit `height: 480px !important` or the flex layout collapses.
- `width: 100%` works for width but `height: 100%` does not propagate. Use `height: 480px` explicitly.
- trmnlp's Liquid `json` filter outputs Ruby hash syntax (`=>` instead of `:`). Use `str.replace(/ => /g, ': ')` before JSON.parse (this is what `parseLiquid` does).
- Only use hex colors #000, #555, #AAA, #fff. Everything else gets Floyd-Steinberg dithered on 2-bit displays (see ADR 0004).
- The `calname` field contains email addresses, not display names. Use `calendar_names` map from the API response.
- In `form_fields.yml` the default key is `default`, not `default_value`. TRMNL silently ignores unknown keys, so a wrong key means no default is applied.
- Editing `full.liquid` only reaches the device after you paste it into the TRMNL markup editor and Force Refresh; the repo file is not deployed automatically.
