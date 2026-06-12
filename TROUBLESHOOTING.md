# Troubleshooting

This guide helps debug common issues with the Calendar + Weather plugin **deployed on [trmnl.com](https://trmnl.com)**. It covers the three data sources: Google Calendar, Weather, and Air Quality, all served by the [Apps Script middleware](MIDDLEWARE_SETUP.md). For local development with trmnlp, refer to the [Local development section in README.md](README.md#local-development).

## How to test changes

After making any configuration change described below:

1. **Save the plugin** using the button in the top right of the edit page
2. Click **Force Refresh** to trigger a new data poll and generate a fresh preview image
3. Check the **preview image** on the plugin page to verify the fix

If you changed the **Apps Script middleware**, remember code edits only go live after **Deploy > Manage deployments > New version**; then Force Refresh the plugin. If the preview still looks wrong, wait a few minutes and Force Refresh again.

To see the updated image on your **physical TRMNL display**, you need to wait until its next scheduled refresh cycle. Force Refresh only regenerates the server-side preview.

## Diagnostic overlay

The plugin includes a built-in diagnostic overlay that appears directly on the rendered image when data issues are detected. A black-bordered message box will show details about what failed. Common messages:

| Message | Meaning |
|---------|---------|
| **No data received** | Neither calendar nor weather data was received. The polling URLs or the middleware token may be misconfigured. |
| **Calendar: no data received** | IDX_0 (calendar polling URL) returned empty data. The middleware URL or token may be misconfigured. |
| **Calendar: bad data received** | IDX_0 returned data but it could not be parsed as valid JSON. |
| **Calendar: data truncated** | The calendar JSON was cut off mid-stream because TRMNL's data size limit was exceeded. Reduce the number of selected calendars or lower `daysAhead`/`maxTextLength` in the middleware CONFIG. |
| **Calendar: unexpected format** | IDX_0 returned data but it doesn't contain the expected `events` array or `data.events` structure. |
| **Calendar: data received but 0 events** | The middleware responded correctly but the events array is empty. Check that your calendars are checked ("selected") in Google Calendar. |
| **Weather: no data received** | IDX_1 (weather polling URL) returned empty data. Check the `src=weather` polling URL for typos. |
| **Weather: bad data received** | IDX_1 returned data but it could not be parsed as valid JSON. |
| **Weather: data truncated** | The weather JSON was cut off mid-stream because TRMNL's data size limit was exceeded. |

The overlay also shows the raw structure of the received data (truncated) to help identify format mismatches.

---

## Calendar not working

### Check the middleware response

Open your calendar polling URL directly in a browser:

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=cal&tz=YOUR_TIMEZONE
```

You should see JSON with `data.events` (array), `data.calendar_names`, `data.today_in_tz`, and `data.first_day`. If instead you see:

| Response | Cause |
|----------|-------|
| `{"error": "unauthorized"}` | The `token` in the URL doesn't match `CONFIG.token` in the Apps Script |
| `{"error": "middleware not configured..."}` | `CONFIG.token` is still the placeholder; edit the script and deploy a new version |
| `{"error": "missing tz parameter..."}` or `missing lat/lon/tz` | The polling URL lacks required parameters (`tz` on all three URLs; `lat`/`lon` on weather/AQI) |
| An empty `events` array `[]` | No calendars selected (see below) or no events in the coming days |
| Behavior not matching the code | The script was edited but a **new version** was never deployed |

### Check which calendars are included

The middleware includes every calendar that is **checked ("selected")** in the Google Calendar UI of the account that deployed it. If a calendar's checkbox is off, its events are skipped.

To pin an explicit set instead, list calendar IDs in `CONFIG.calendarIds` and deploy a new version.

### Check the Apps Script executions

In the Apps Script editor, open **Executions** (left sidebar). Every TRMNL poll appears there with its status; a failing execution shows the error message.

You can also run `testCalendarPayload` directly in the editor and inspect the logged JSON to see exactly what the middleware produces.

### Events missing on specific days

The plugin renders a rolling window of **today + 6 days**; past days are not shown. The middleware serves today + `CONFIG.daysAhead` (10 by default), so the plugin's window is always covered.

### Still no calendar data?

1. Create a test event on today's date and Force Refresh
2. For shared calendars, confirm the deploying account still has access to them
3. Check if the issue is specific to certain calendars or all calendars

---

## Weather not working

### Check the middleware response

Open your weather polling URL directly in a browser:

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=weather&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
```

You should see a JSON response with `daily`, `hourly`, and `current` objects. `{"error": "upstream fetch failed..."}` means Open-Meteo failed and nothing was cached yet (see the trigger below).

### Check the cache-refresh trigger

The middleware serves weather from a cache warmed by a time-driven trigger on `refreshUpstreamCaches` (every 15 minutes). Without it, a poll on a cold cache must wait on Open-Meteo live, and a failing Open-Meteo has no fallback copy. Verify the trigger exists under **Triggers** (clock icon) in the Apps Script editor.

### Check Open-Meteo directly

Open the underlying API in a browser (no authentication needed):

```
https://api.open-meteo.com/v1/forecast?latitude=YOUR_LAT&longitude=YOUR_LON&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max&hourly=temperature_2m,precipitation_probability&current=temperature_2m&timezone=YOUR_TIMEZONE&forecast_days=7
```

If this fails, check:

- **Latitude/longitude** are valid numbers (e.g., `41.39` / `2.17` for Barcelona)
- **Timezone** is a valid IANA timezone (e.g., `Europe/Madrid`, `America/New_York`)

Find your coordinates at [open-meteo.com](https://open-meteo.com/en/docs).

### Verify it's the second polling URL

The `src=weather` URL must be the **second line** in your private plugin's polling URLs (it maps to IDX_1). If the order is wrong, the plugin will try to parse calendar data as weather and vice versa.

---

## Air quality not working

### Check the middleware response

Open your air quality polling URL directly in a browser:

```
YOUR_SCRIPT_URL?token=YOUR_SECRET_TOKEN&src=aqi&lat=YOUR_LAT&lon=YOUR_LON&tz=YOUR_TIMEZONE
```

You should see a JSON response with a `current` object containing `european_aqi`.

### Air quality is optional

If you don't need AQI data, you can remove the third polling URL entirely. The plugin works fine without it.

### Verify it's the third polling URL

The `src=aqi` URL must be the **third line** in your private plugin's polling URLs (it maps to IDX_2). The order of all three URLs matters.

---

## Polling configuration issues

If none of the three data sources are working, the problem is likely in the private plugin's polling setup or the middleware deployment.

### Check the polling configuration

1. Go to your **Calendar + Weather** private plugin settings
2. Verify:
   - **Polling URLs** are one per line, in the correct order (`src=cal`, `src=weather`, `src=aqi`), all pointing to the same `/exec` URL with the same `token`
   - **Polling Verb** is `GET`
   - No polling headers are required

### Common mistakes

- Missing or mistyped `token` parameter (must match `CONFIG.token` exactly)
- Polling URLs in the wrong order (must be: cal, weather, aqi)
- The Apps Script was edited but no **new version** was deployed (the `/exec` URL keeps serving the old code)
- Extra spaces or line breaks in URLs

---

## Data format reference

The plugin expects this structure from the calendar source (IDX_0):

```json
{
  "data": {
    "events": [
      {
        "summary": "Event Title",
        "start_full": "2026-04-17T09:00:00.000+02:00",
        "end_full": "2026-04-17T10:00:00.000+02:00",
        "date_time": "2026-04-17T09:00:00.000+02:00",
        "calname": "user@gmail.com",
        "all_day": false,
        "description": "Optional description",
        "location": "Optional location"
      }
    ],
    "calendar_names": {
      "user@gmail.com": "Personal",
      "work@company.com": "Work"
    },
    "today_in_tz": "2026-04-17T10:30:00+02:00",
    "now_in_tz": "2026-04-17T10:30:00+02:00",
    "first_day": 1
  }
}
```

Key fields:
- `events` can be at `data.events` (production) or at the top level
- `start_full` / `end_full` are ISO timestamps with timezone offset (used for time positioning)
- `date_time` determines which date column the event belongs to
- `all_day` boolean determines if the event goes in the all-day strip
- `calname` contains an email address, mapped to a display name via `calendar_names`

This is the same shape TRMNL's own calendar `/data` endpoint returns, so a legacy direct setup (TRMNL Google Calendar plugin + direct Open-Meteo URLs) parses identically.
