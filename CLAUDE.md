# TRMNL Calendar + Weather Plugin

## What This Is

Custom TRMNL e-ink display plugin combining Google Calendar (weekly time-grid view) with Open-Meteo weather forecast and air quality. Single Liquid template with embedded CSS + JS.

## Architecture

- **Data strategy:** Private Plugin with Polling (3 URLs), all pointing to one Google Apps Script middleware (`?src=cal|weather|aqi`)
  - `IDX_0` = `src=cal` - Google Calendar events read directly by the script, served from a trigger-warmed cache (building live is ~15s and can exceed TRMNL's 30s timeout); mimics the TRMNL calendar `/data` shape (flat array with `date_time`, `start_full`, `end_full`, `calname`)
  - `IDX_1` = `src=weather` - Open-Meteo forecast passthrough (daily + hourly + current), served from a trigger-warmed cache
  - `IDX_2` = `src=aqi` - Open-Meteo air quality passthrough (optional, European AQI)
- **Legacy direct mode:** the TRMNL calendar `/data` URL + direct Open-Meteo URLs still parse identically; the middleware replaced them for reliability (see Gotchas).
- **Rendering:** JS builds the DOM from Liquid-injected JSON. No external dependencies.
- **Screen:** 800x480px, 2-bit grayscale (4 native shades: #000, #555, #AAA, #fff)

## Key Files

- `src/full.liquid` - Production template (paste into TRMNL markup editor)
- `src/settings.yml` - Plugin settings + polling URLs for trmnlp local dev
- `src/middleware/calendar_weather_proxy.gs` - Apps Script middleware (deployed manually at script.google.com; setup in `MIDDLEWARE_SETUP.md`)
- `.trmnlp.yml` - Local dev config with sample data

## Patterns

- Calendar events come as a flat array from the TRMNL API (not grouped by date)
- Event times prefer `start_full`/`end_full` ISO timestamps; the AM/PM `start`/`end` fields are used as fallback when `start_full`/`end_full` are absent
- `calname` contains email addresses, `calendar_names` map resolves them to display names
- Multi-day all-day events are duplicated onto each day they span
- Weather dates (ISO) used as the column source; calendar events matched by date
- Template supports both production (IDX_0 at top level) and trmnlp (custom_fields with Ruby hash format)

## Gotchas

- TRMNL framework wraps content in `.screen > .view > .layout` divs that add padding. Override with `padding: 0 !important`.
- `.layout--row` needs explicit `height: 480px !important` or the flex layout collapses.
- `width: 100%` works for width but `height: 100%` does not propagate. Use `height: 480px` explicitly.
- trmnlp's Liquid `json` filter outputs Ruby hash syntax (`=>` instead of `:`). Use `str.replace(/ => /g, ': ')` before JSON.parse.
- Only use hex colors #000, #555, #AAA, #fff. Everything else gets Floyd-Steinberg dithered on 2-bit displays.
- The `calname` field contains email addresses, not display names. Use `calendar_names` map from the API response.
- TRMNL pauses a native plugin's data sync while it is hidden in playlists (despite the tooltip claiming "Data sync is active"). This is why the middleware exists.
- TRMNL's polling timeout is 30s, fixed, and one slow URL degrades the whole plugin (all URLs treated as a unit).
- Apps Script: code edits only go live after Deploy > Manage deployments > pencil icon > New version. The `/exec` URL otherwise keeps serving the old code. Deploy > "New deployment" is the wrong path: it mints a second `/exec` URL and leaves the original one on the old code.
- `?src=cal` returns `middleware_version` (a constant in the .gs). Compare it against the repo copy to check which code a deployment is serving.
- `?src=cal&debug=1` skips the declined-events filter and adds a `debug_rsvp` object (RSVP status, guests, owner) to every event.
- In `form_fields.yml` the default key is `default`, not `default_value`. TRMNL silently ignores unknown keys, so a wrong key means no default is applied.
