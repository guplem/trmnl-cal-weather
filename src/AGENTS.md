# Template area (`src/`)

The Liquid template that TRMNL renders. `full.liquid` is the production template: its inline JS parses the polled JSON and builds the weekly time-grid DOM. `half_horizontal.liquid`, `half_vertical.liquid`, and `quadrant.liquid` are "full view only" stubs (see ADR 0003). `settings.yml` and `form_fields.yml` are the plugin config. The middleware that feeds the template has its own area doc in `src/middleware/AGENTS.md`.

Repo-wide conventions, the ADR index, and the Git workflow live in the root `AGENTS.md`; this file holds only what is specific to the template.

## Extracted pure helpers (`src/lib/`)

The pure logic inside `full.liquid`'s inline JS is copied into `src/lib/` so it can run under `bun test` (there is no build step to import from). `src/lib/` is the tested source of truth; `full.liquid` keeps its own inline copy of the same functions.

| `src/lib/` module | Functions | Inlined in |
|---|---|---|
| `eventLayout.js` | `toMin`, `layoutOverlaps` | `full.liquid` |
| `dateLabels.js` | `dayInfo`, `calKey` | `full.liquid` |
| `ignoredEvents.js` | `compileIgnoredPhrases`, `isIgnoredEvent` | `full.liquid` |
| `jsonRecovery.js` | `sanitizeJson`, `parseLiquid`, `hasCalData`, `deepParse` | `full.liquid` |
| `weatherIcon.js` | `wIcon` | `full.liquid` |
| `middleware.js` | `cleanText`, `cacheKey`, `forecastUrl` | `src/middleware/calendar_weather_proxy.gs` |

`isIgnoredEvent` and `cleanText` are extracted with their outer dependency turned into a parameter (the compiled phrases array; the max length), so the module stays pure. The behavior is otherwise identical to the inline original.

## Gotchas

- **Keep `src/lib` and the inline copy in sync (critical).** When you change a helper in `full.liquid`'s inline JS, change the matching `src/lib/*.js` and its test, and vice versa. There is no build step, so nothing enforces this at runtime; only the test suite and this rule do. See ADR 0006.
- TRMNL framework wraps content in `.screen > .view > .layout` divs that add padding. Override with `padding: 0 !important`.
- `.layout--row` needs explicit `height: 480px !important` or the flex layout collapses.
- `width: 100%` works for width but `height: 100%` does not propagate. Use `height: 480px` explicitly.
- trmnlp's Liquid `json` filter outputs Ruby hash syntax (`=>` instead of `:`). Use `str.replace(/ => /g, ': ')` before JSON.parse (this is what `parseLiquid` does).
- Only use hex colors #000, #555, #AAA, #fff. Everything else gets Floyd-Steinberg dithered on 2-bit displays (see ADR 0004).
- The `calname` field contains email addresses, not display names. Use `calendar_names` map from the API response.
- In `form_fields.yml` the default key is `default`, not `default_value`. TRMNL silently ignores unknown keys, so a wrong key means no default is applied.
- Editing `full.liquid` only reaches the device after you paste it into the TRMNL markup editor and Force Refresh; the repo file is not deployed automatically.
