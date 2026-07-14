# Middleware Setup (Google Apps Script)

The plugin's data layer: one small Google Apps Script web app serves all three data sources, so the plugin never depends on the TRMNL Google Calendar plugin or on direct Open-Meteo calls.

```
TRMNL Polling (every ~15 min)
    |
    +--> IDX_0: YOUR_SCRIPT_URL?src=cal      -- Google Calendar events, from cache
    +--> IDX_1: YOUR_SCRIPT_URL?src=weather  -- Open-Meteo forecast, from cache
    +--> IDX_2: YOUR_SCRIPT_URL?src=aqi      -- Open-Meteo air quality, from cache
                      |
        Google Apps Script web app (free, runs as your Google account)
                      |
        time-driven trigger refreshes all three caches every 15 min
```

## Why

- **No more stale calendar data.** TRMNL pauses the Google Calendar plugin's data sync while it is hidden in a playlist, so events polled from its `/data` endpoint freeze. The script reads your calendars directly from Google, so the TRMNL Google Calendar plugin is no longer needed at all.
- **No more timeouts.** TRMNL's polling timeout is 30 seconds and cannot be raised. Open-Meteo occasionally takes 10-25s+, and building the calendar live (reading every calendar plus a per-event RSVP check) takes ~15s and can spike past 30s. Either one degrades the plugin and eventually stops auto-refresh. The script answers TRMNL instantly from a cache for all three sources and keeps serving the last good copy if an upstream is slow or down.
- **One place for control and logs.** Apps Script keeps execution logs (Executions tab), and you can extend the script freely.

The `?src=cal` response mimics the JSON shape of TRMNL's calendar `/data` endpoint (see the [Data format reference](TROUBLESHOOTING.md#data-format-reference)), so **the Liquid template needs zero changes**.

## Setup

### Step 1: Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) while logged in to the Google account that owns the calendars
2. Click **New project**
3. Name it (top left), e.g. `trmnl-cal-weather-proxy`

### Step 2: Paste the code

Replace the contents of `Code.gs` with [`src/middleware/calendar_weather_proxy.gs`](src/middleware/calendar_weather_proxy.gs).

### Step 3: Set the project timezone

1. Open **Project Settings** (gear icon)
2. Set **Time zone** to your timezone (e.g. `Europe/Madrid`)

> This controls how `Date` math behaves inside the script. Set it to the same timezone you will pass as the `tz` URL parameter.

### Step 4: Fill in CONFIG

At the top of the script, set:

| Field | Value |
|-------|-------|
| `token` | A long random string (40+ chars). This is the only thing protecting your data. |
| `calendarIds` | Leave `[]` to use every calendar checked in your Google Calendar UI, or list explicit IDs |
| `hideDeclinedEvents` | `true` (default) hides events you answered "No" to; set `false` to keep showing them |

> Location and timezone are NOT configured in the script: every request must carry them as `lat`/`lon`/`tz` URL parameters (filled by the TRMNL plugin form fields).

### Step 5: Authorize the script

1. In the editor toolbar, select the function **`testCalendarPayload`** and click **Run**
2. Google asks for permissions (read calendars, contact external services). Approve them.
3. Check the **Execution log**: it should print a JSON payload containing your events (the test uses the project timezone from Step 3)

> Google may warn the app is "unverified" because you wrote it yourself. Click **Advanced** > **Go to (project name)** to continue. You are only granting access to your own script.

### Step 6: Deploy as a web app

1. Click **Deploy** > **New deployment**
2. Type: **Web app**
3. **Execute as:** `Me`
4. **Who has access:** `Anyone`
5. Click **Deploy** and copy the web app URL (ends in `/exec`). This is `YOUR_SCRIPT_URL`.

> "Anyone" means anyone who knows the URL **and the token** can read the JSON. The script rejects requests without the correct `token` parameter. Treat the full URL as a secret.

### Step 7: Test in a browser

Open these and verify each returns JSON (events, forecast, AQI):

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=cal&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=weather&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=aqi&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
```

URL parameters (all required):

| Parameter | Used by | Meaning |
|-----------|---------|---------|
| `token` | all | Must match `CONFIG.token` |
| `src` | all | `cal`, `weather`, or `aqi` |
| `tz` | all | IANA timezone (e.g. `Europe/Madrid`); controls event timestamps and the forecast timezone |
| `lat` / `lon` | `weather`, `aqi` | Location for Open-Meteo |

### Step 8: Create the cache-refresh trigger

1. Open **Triggers** (clock icon in the left sidebar) > **Add Trigger**
2. Function: **`refreshUpstreamCaches`**
3. Event source: **Time-driven** > **Minutes timer** > **Every 15 minutes**
4. Save

This keeps all three caches (calendar, weather, AQI) warm so TRMNL is always answered instantly, even when Open-Meteo is slow or the calendar build takes ~15s. The trigger rebuilds the calendar for the most recently requested timezone and warms the most recently requested location; each source does nothing until its first request has been served.

### Step 9: Point the TRMNL plugin at the proxy

In your private plugin's settings, set the three **Polling URLs** (order matters: calendar, weather, air quality):

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=cal&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=weather&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=aqi&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
```

**Polling Verb** stays `GET`. The `authorization=bearer` polling header is no longer needed (it is harmless if kept).

Save, then **Force Refresh** and verify events and weather render.

> Prefer a gradual switch? Replace only the first URL (`src=cal`) and keep the old Open-Meteo URLs for IDX_1/IDX_2. Switch them later.

### Step 10: Migrating from the legacy setup?

If this plugin previously used the TRMNL Google Calendar plugin + direct Open-Meteo URLs: once `src=cal` is live, the Google Calendar plugin is no longer read. You can remove it from all playlists or uninstall it.

> The week-start day (`first_day`) previously came from the Google Calendar plugin's settings; it now comes from `CONFIG.firstDayOfWeek`.

## Gotchas

- **Code edits need a redeploy.** Editing the script does NOT update the live URL. Go to **Deploy** > **Manage deployments** > pencil icon > **Version: New version** > **Deploy**. The URL stays the same.
- **The `/exec` URL replies with a 302 redirect** (to `script.googleusercontent.com`). Browsers and TRMNL's poller follow it automatically. If IDX_0 looks empty right after switching, check the plugin's Debug Logs for the `Processed merge_variables IDX_0` line.
- **Do not commit the token.** `src/settings.yml` is checked into the repo; keep placeholders there. For local trmnlp development you can temporarily paste the proxy URLs into `settings.yml`, but revert before committing.
- **Quotas are not a concern.** Free Google accounts get 20,000 external fetches/day; this setup uses ~200.
