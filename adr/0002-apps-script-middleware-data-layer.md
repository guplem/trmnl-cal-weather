# Cache-warmed Google Apps Script middleware as the single data layer

## Context

TRMNL polls a plugin's data URLs to refresh the display. The original design used TRMNL's native Google Calendar plugin for events plus direct Open-Meteo URLs for weather and air quality. Two fixed TRMNL limits broke this:

- **Playlist pause.** TRMNL pauses a native plugin's data sync while the plugin is hidden in a playlist, so the calendar events polled from its `/data` endpoint freeze (despite a tooltip claiming sync is active).
- **30s poll timeout.** TRMNL's polling timeout is 30 seconds and cannot be raised. Open-Meteo occasionally takes 10-25s+, and building the calendar live (reading every calendar plus a per-event RSVP check) takes ~15s and can spike past 30s. All polling URLs are treated as a unit, so one slow URL degrades the whole plugin.

## Decision

Serve all three data sources from one Google Apps Script web app (`src/middleware/calendar_weather_proxy.gs`), addressed by `?src=cal|weather|aqi`. It runs on the owner's own Google account (free, no server).

- It reads Google Calendars directly with `CalendarApp`, so the TRMNL native Google Calendar plugin is no longer involved and the playlist pause cannot freeze events.
- It answers TRMNL instantly from `CacheService`. A time-driven trigger (`refreshUpstreamCaches`, every 15 minutes) rebuilds the calendar payload and warms the Open-Meteo caches, so a poll never waits on a live upstream. If an upstream is slow or down, the last good cached copy keeps serving (`cacheMaxAgeSeconds` = 21600, the 6h CacheService maximum).
- The `?src=cal` response mimics the shape of TRMNL's calendar `/data` endpoint, so the template parses the middleware output and the legacy direct output identically.

**Rejected alternative:** TRMNL native Google Calendar plugin + direct Open-Meteo URLs. Rejected because the playlist pause freezes calendar data and the 30s timeout trips on slow Open-Meteo responses and the ~15s live calendar build; neither limit can be configured away on the TRMNL side.

## Consequences

**Positive:**

- No stale calendar data in playlists, and no timeouts: TRMNL always gets an instant cached answer.
- One place for control and logs (the Apps Script Executions tab), and freedom to extend the script.

**Trade-offs and follow-up:**

- The owner must deploy and maintain the script, and redeploy a New version for code edits to go live (the `/exec` URL keeps serving old code otherwise; see `src/middleware/AGENTS.md`).
- The middleware runs on Google Apps Script and cannot be imported by `bun test`; its pure helpers are mirrored into `src/lib` for testing (ADR 0006) and its Google-glued functions rely on live-deploy verification.
