# TRMNL Calendar + Weather Plugin

## What This Is

Custom TRMNL e-ink display plugin combining Google Calendar (weekly time-grid view) with Open-Meteo weather forecast and air quality. Single Liquid template with embedded CSS + JS.

## Architecture

- **Data strategy:** Private Plugin with Polling (3 URLs)
  - `IDX_0` = TRMNL Calendar API (flat array of events with `date_time`, `start_full`, `end_full`, `calname`)
  - `IDX_1` = Open-Meteo forecast (daily + hourly + current temperature)
  - `IDX_2` = Open-Meteo air quality (optional, European AQI)
- **Rendering:** JS builds the DOM from Liquid-injected JSON. No external dependencies.
- **Screen:** 800x480px, 2-bit grayscale (4 native shades: #000, #555, #AAA, #fff)

## Key Files

- `src/full.liquid` - Production template (paste into TRMNL markup editor)
- `src/settings.yml` - Plugin settings + polling URLs for trmnlp local dev
- `.trmnlp.yml` - Local dev config with sample data

## Patterns

- Calendar events come as a flat array from the TRMNL API (not grouped by date)
- Event times parsed from `start_full`/`end_full` ISO timestamps (not the AM/PM `start`/`end` fields)
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
