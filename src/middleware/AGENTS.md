# Middleware area (`src/middleware/`)

`calendar_weather_proxy.gs` is the Google Apps Script web app that serves all three data sources (`?src=cal|weather|aqi`). It reads the owner's Google Calendars directly and proxies Open-Meteo, answering TRMNL instantly from a cache that a 15-minute time-driven trigger (`refreshUpstreamCaches`) keeps warm. This exists to beat two TRMNL limits: the playlist data-sync pause and the fixed 30s poll timeout (see ADR 0002). **`calendar_weather_proxy.gs` is a generated file** (do not edit it): `calendar_weather_proxy.gs.template` is the hand-edited shell, and `bun run build` inlines the pure helpers into it. Deploy and setup steps for humans: `MIDDLEWARE_SETUP.md`.

Repo-wide conventions, the ADR index, and the Git workflow live in the root `AGENTS.md`; this file holds only what is specific to the middleware.

## Pure helpers: single source in `src/lib/middleware.js`

`cleanText`, `cacheKey`, and `forecastUrl` are pure and live only in `src/lib/middleware.js` (the tested source of truth). `bun run build` inlines them into the `.gs` at the `@generated:helpers` marker in `calendar_weather_proxy.gs.template`; there is no second copy to keep in sync. `cleanText` reads `CONFIG.maxTextLength` in the `.gs`, so in `src/lib` the limit is a parameter (`cleanText(text, maxTextLength)`) and the build emits it as `cleanTextPure` plus a wrapper `cleanText(text)` that binds `CONFIG.maxTextLength`, keeping the `.gs` call sites unchanged. See ADR 0006.

The Google-glued functions (`buildCalendarPayload`, `isDeclinedByMe`, `serveCached`, and the `CacheService`/`CalendarApp`/`UrlFetchApp` calls) are authored directly in the template and exempt from unit tests; their safety net is a live deploy plus the Executions log.

## Gotchas

- **`calendar_weather_proxy.gs` is generated; never edit it directly (critical).** Edit `src/lib/middleware.js` (and its test) or `calendar_weather_proxy.gs.template`, then run `bun run build`. The drift test (`src/lib/generated.test.js`) fails CI if the committed `.gs` is stale or hand-edited. Bump `MIDDLEWARE_VERSION` (in the `.template`) on every code change. See ADR 0006.
- Apps Script: code edits only go live after Deploy > Manage deployments > pencil icon > New version. The `/exec` URL otherwise keeps serving the old code. Deploy > "New deployment" is the wrong path: it mints a second `/exec` URL and leaves the original one on the old code.
- `?src=cal` returns `middleware_version` (the `MIDDLEWARE_VERSION` constant in the `.gs`). Compare it against the repo copy to check which code a deployment is serving. Bump it on every code change.
- `?src=cal&debug=1` skips the declined-events filter and adds a `debug_rsvp` object (RSVP status, guests, owner) to every event.
- Do not commit a real `CONFIG.token`; keep the placeholder `'YOUR_SECRET_TOKEN'` in the repo copy.
