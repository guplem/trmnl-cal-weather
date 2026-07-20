# Middleware area (`src/middleware/`)

`calendar_weather_proxy.gs` is the Google Apps Script web app that serves all three data sources (`?src=cal|weather|aqi`). It reads the owner's Google Calendars directly and proxies Open-Meteo, answering TRMNL instantly from a cache that a 15-minute time-driven trigger (`refreshUpstreamCaches`) keeps warm. This exists to beat two TRMNL limits: the playlist data-sync pause and the fixed 30s poll timeout (see ADR 0002). Deploy and setup steps for humans: `MIDDLEWARE_SETUP.md`.

Repo-wide conventions, the ADR index, and the Git workflow live in the root `AGENTS.md`; this file holds only what is specific to the middleware.

## Extracted pure helpers

`cleanText`, `cacheKey`, and `forecastUrl` are pure and are copied into `src/lib/middleware.js` for testing. The `.gs` runs on Google Apps Script and cannot be imported by `bun test`, so `src/lib/middleware.js` is the tested source of truth and the `.gs` keeps its own inline copy. **Keep the two in sync (critical):** change a helper here and you change `src/lib/middleware.js` and its test too, and vice versa. `cleanText` reads `CONFIG.maxTextLength` here; in `src/lib` the limit is a parameter. See ADR 0006.

The Google-glued functions (`buildCalendarPayload`, `isDeclinedByMe`, `serveCached`, and the `CacheService`/`CalendarApp`/`UrlFetchApp` calls) are exempt from unit tests; their safety net is a live deploy plus the Executions log.

## Gotchas

- Apps Script: code edits only go live after Deploy > Manage deployments > pencil icon > New version. The `/exec` URL otherwise keeps serving the old code. Deploy > "New deployment" is the wrong path: it mints a second `/exec` URL and leaves the original one on the old code.
- `?src=cal` returns `middleware_version` (the `MIDDLEWARE_VERSION` constant in the `.gs`). Compare it against the repo copy to check which code a deployment is serving. Bump it on every code change.
- `?src=cal&debug=1` skips the declined-events filter and adds a `debug_rsvp` object (RSVP status, guests, owner) to every event.
- Do not commit a real `CONFIG.token`; keep the placeholder `'YOUR_SECRET_TOKEN'` in the repo copy.
