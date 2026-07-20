# TRMNL Calendar + Weather Plugin

A custom [TRMNL](https://usetrmnl.com) plugin that combines your **Google Calendar** weekly view with a **7-day weather forecast** and **air quality** data.

> Designed for the **TRMNL (OG)** in **full** view (800x480) with the [2-bit palette](https://help.trmnl.com/en/articles/12985974-understanding-color-palettes#:~:text=transitions%20between%20screens-,Changing%20the%20Palette,-The%20preferred%20color) enabled. *TRMNL (X) is not supported.*

![Demo](calendar-weather-demo.png)

## Features

- **Time-grid weekly calendar** - Events positioned at their actual time slots, just like Google Calendar
- **Multiple Google Calendars** - Each calendar gets a distinct grayscale bar pattern (supports up to 11 calendars)
- **Overlapping events** - Displayed side by side automatically
- **Weather forecast per day** - Icon + min/max temperature in a compact row near the top
- **Hourly weather charts** - Precipitation probability bars + temperature line behind each day's header
- **Hourly forecast on time axis** - Temperature labels at each half-hour mark, with precipitation probability bars behind them
- **Current conditions** - Current temperature and today's rain probability in the top-left corner
- **Sunrise/sunset, UV index, air quality** - Displayed in the bottom legend row
- **Current time indicator** - Bold tick on the time axis
- **Past events dimmed** - Gray background for events that have already ended (vs white for upcoming ones)
- **Week start separator** - Darker vertical line at the first day of the week (taken from your Google Calendar plugin settings)
- **All-day events** - Displayed in a dedicated strip with the same grayscale pattern bars as timed events
- **Event details** - Location and description shown for longer events
- **Graceful degradation** - Works with partial data (calendar only, weather only, or both)
- **2-bit optimized** - Uses the four native grayscale shades

## Prerequisites

- A **TRMNL (OG)** with the **[2-bit palette](https://help.trmnl.com/en/articles/12985974-understanding-color-palettes#:~:text=transitions%20between%20screens-,Changing%20the%20Palette,-The%20preferred%20color) enabled** (available with [firmware >=1.6.0](https://github.com/usetrmnl/trmnl-firmware/releases/tag/v1.6.0#:~:text=Adds%202%2Dbit%20grayscale)) and **Developer perks** enabled (comes with BYOD or Developer Edition)
- A **Google account** with access to the calendars you want to display (it will run the middleware)

## Setup

> **Quick install:** the plugin is published as an unlisted recipe on the TRMNL dashboard at [trmnl.com/recipes/282491](https://trmnl.com/recipes/282491). The recipe pre-fills the polling URLs and markup template (Steps 2 and 3 below), so you only need to follow Step 1 (deploy the middleware), then fill in the form fields when installing. Step 4 (Test) is recommended to verify the install.

### Step 1: Deploy the middleware

All data (calendar, weather, air quality) is served by a small **Google Apps Script** that you deploy once on your own Google account. It is free, takes ~10 minutes, and needs no server. Follow **[MIDDLEWARE_SETUP.md](MIDDLEWARE_SETUP.md)**.

You will end up with the two values used in the next step:

- `YOUR_SCRIPT_URL` - the web app URL (ends in `/exec`)
- `YOUR_SECRET_TOKEN` - the token you set in the script's `CONFIG`

> Why a middleware? TRMNL's native Google Calendar plugin stops syncing while hidden in a playlist, and TRMNL's fixed 30s polling timeout trips on slow Open-Meteo responses. The script reads your calendars directly from Google and serves Open-Meteo from a cache, which removes both failure modes.

### Step 2: Create the Private Plugin

1. Go to **Plugins** > search **Private Plugin** > **Create**
2. Configure:
   - **Name:** `Calendar + Weather`
   - **Strategy:** `Polling`
   - **Polling URL(s)** (one per line, replace `YOUR_SCRIPT_URL`, `YOUR_SECRET_TOKEN`, and your coordinates/timezone):

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=cal&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=weather&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=aqi&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
```

   - **Polling Verb:** `GET`

3. Save

> No polling headers are needed; the `token` parameter is the authentication.

> The third URL (air quality) is optional. Remove it if you don't need AQI data.

### Step 3: Add the template

1. Open your Private Plugin's settings
2. Go to the **Markup** tab (Full view)
3. Copy the entire contents of [`src/full.liquid`](src/full.liquid) and paste it in
4. Save

### Step 4: Test

1. Click **Force Refresh** on the plugin page
2. Wait ~30 seconds for data to be polled and rendered
3. Check your TRMNL device

## Customization

### Change location

Replace the `lat`, `lon`, and `tz` parameters in the polling URLs (`tz` appears on all three, `lat`/`lon` on weather and air quality):

| Parameter | Example |
|-----------|---------|
| `lat` | `41.39` (Barcelona) |
| `lon` | `2.17` (Barcelona) |
| `tz` | `Europe/Madrid` |

Find your coordinates at [open-meteo.com](https://open-meteo.com/en/docs).

### Choose calendars

By default the middleware includes every calendar that is checked ("selected") in the Google Calendar UI of the account that deployed it. To pin an explicit set instead, list calendar IDs in `CONFIG.calendarIds` in the Apps Script and deploy a new version.

### Ignore events

Fill the **Ignored phrases** plugin setting with a comma-separated list of patterns. Each pattern is a case-insensitive [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) tested against the event title and description:

| Pattern | Hides events that... |
|---------|----------------------|
| `Work` | contain "Work" anywhere (also "Workshop") |
| `^Work$` | are titled exactly "Work" |
| `\bSDG\b` | contain "SDG" as a whole word (not "SDGs") |

An invalid regex is treated as literal text. Patterns cannot contain commas, so a quantifier like `{2,3}` cannot be used; alternation works within one pattern (e.g. `^(Work|SDG)$`).

Events answered with "No" are hidden automatically by the middleware: your own declined invites, and events on a shared calendar that its owner declined. To keep showing them, set `CONFIG.hideDeclinedEvents` to `false` in the Apps Script and deploy a new version.

### Calendar bar patterns

Calendars are automatically assigned visual patterns based on alphabetical order of their names. The 11 available patterns cycle through:

| # | Style |
|---|-------|
| 1 | Solid light gray |
| 2 | Solid black |
| 3 | White with black border |
| 4 | Gray diagonal stripes |
| 5 | Black diagonal stripes (reversed) |
| 6 | Gray horizontal stripes |
| 7 | Gray vertical stripes |
| 8 | Black horizontal stripes |
| 9 | Black vertical stripes |
| 10 | Gray diagonal stripes (reversed) |
| 11 | Black diagonal stripes |

Calendar names are resolved from email addresses using Google Calendar's display names.

### Temperature units

Open-Meteo returns Celsius by default. For Fahrenheit, add `&temperature_unit=fahrenheit` to the URL built in `forecastUrl()` in the Apps Script, then deploy a new version.

## Local development

You can preview the plugin locally using [trmnlp](https://github.com/usetrmnl/trmnlp):

```bash
gem install trmnl_preview
cd trmnl-cal-weather
trmnlp serve
```

The `.trmnlp.yml` file includes sample data. The template auto-detects the trmnlp environment and reads data from custom fields.

### Running the tests

The pure logic (time parsing, overlap layout, ignored-event matching, JSON recovery, text cleanup) is extracted into `src/lib/` and covered by unit tests. Run them with [Bun](https://bun.sh):

```bash
bun test .
```

## Architecture

```
TRMNL Polling (every ~15 min)
    |
    +--> IDX_0: ?src=cal      (events + calendar names)
    |
    +--> IDX_1: ?src=weather  (daily + hourly + current)
    |
    +--> IDX_2: ?src=aqi      (optional, European AQI)
              |
    Google Apps Script middleware (free, your own account)
        reads Google Calendar directly
        serves Open-Meteo from a cache (15-min trigger)
              |
        Liquid Template (full.liquid)
              |
        JS builds time-grid layout
        groups events by date
        positions at actual time slots
        handles overlaps side-by-side
              |
        Rendered to 800x480 e-ink bitmap
```

## Data sources

- **Calendar:** your Google Calendar, read directly by the [Apps Script middleware](MIDDLEWARE_SETUP.md) (no TRMNL Google Calendar plugin involved)
- **Weather:** [Open-Meteo](https://open-meteo.com) free forecast API (no key, no registration), served through the middleware cache
- **Air Quality:** [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (European AQI, optional)

## Troubleshooting

The plugin includes a **built-in diagnostic overlay** that appears on-screen when data issues are detected (e.g., missing calendar data, unexpected format, empty events). This makes it easier to identify problems without needing browser access. It is enabled by default; once your device is working reliably, you can turn it off via the **Show diagnostic overlay** plugin setting, since transient errors (such as a single failed weather call) recover on the next refresh and the overlay covers a large portion of the calendar.

After any configuration change, **save the plugin** (top right) and click **Force Refresh** to generate a new preview image. After editing the Apps Script, remember code changes only go live after deploying a **New version** (Deploy > Manage deployments).

For detailed debugging steps, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.
