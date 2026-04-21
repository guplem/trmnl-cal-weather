# Troubleshooting

This guide helps debug common issues with the Calendar + Weather plugin **deployed on [trmnl.com](https://trmnl.com)**. It covers the three data sources: Google Calendar, Weather, and Air Quality. For local development with trmnlp, refer to the [Local development section in README.md](README.md#local-development).

## How to test changes

After making any configuration change described below:

1. **Save the plugin** using the button in the top right of the edit page
2. Click **Force Refresh** to trigger a new data poll and generate a fresh preview image
3. Check the **preview image** on the plugin page to verify the fix

Some changes take time to propagate, especially updates to the Google Calendar app (selecting calendars, changing layout, reconnecting your Google account). If the preview still looks wrong, wait a few minutes and Force Refresh again.

To see the updated image on your **physical TRMNL display**, you need to wait until its next scheduled refresh cycle. Force Refresh only regenerates the server-side preview.

## Diagnostic overlay

The plugin includes a built-in diagnostic overlay that appears directly on the rendered image when data issues are detected. A black-bordered message box will show details about what failed. Common messages:

| Message | Meaning |
|---------|---------|
| **No data received** | Neither calendar nor weather data was received. The polling URLs may be misconfigured or the API key may be wrong. |
| **Calendar: no data received** | IDX_0 (calendar polling URL) returned empty data. The polling URL or API key may be misconfigured. |
| **Calendar: bad data received** | IDX_0 returned data but it could not be parsed as valid JSON. |
| **Calendar: data truncated** | The calendar JSON was cut off mid-stream because TRMNL's data size limit was exceeded. Reduce the number of selected calendars or switch the Google Calendar plugin layout to "Week". |
| **Calendar: unexpected format** | IDX_0 returned data but it doesn't contain the expected `events` array or `data.events` structure. |
| **Calendar: data received but 0 events** | The calendar API responded correctly but the events array is empty. Check that the Google Calendar plugin has calendars selected. |
| **Weather: no data received** | IDX_1 (weather polling URL) returned empty data. Check the Open-Meteo URL for typos. |
| **Weather: bad data received** | IDX_1 returned data but it could not be parsed as valid JSON. |
| **Weather: data truncated** | The weather JSON was cut off mid-stream because TRMNL's data size limit was exceeded. |

The overlay also shows the raw structure of the received data (truncated) to help identify format mismatches.

---

## Calendar not working

### Check the Google Calendar plugin configuration

1. Go to [trmnl.com](https://trmnl.com) > **Plugins**
2. Find your **Google Calendar** plugin and open its settings
3. Confirm:
   - Google account is connected (re-authorize if needed)
   - All desired calendars are **selected** (hold Ctrl/Cmd to multi-select)
   - Layout is set to **Week** (recommended to avoid data truncation)
4. Save, then Force Refresh your private plugin

### "Week" layout is recommended

The plugin only displays 7 days, so "Week" is the most efficient layout. Other layouts work but return more data:

- **Week**: ~7 days of events, typically 10-30 events
- **Month**: ~6 weeks of events, easily 80-100+ events

The larger payload from "Month" or "Day" can exceed TRMNL's template data size limit, causing the JSON to be truncated mid-stream. If the diagnostic overlay shows "Calendar: data truncated", switch the layout to "Week" or reduce the number of selected calendars.

### Verify the Google Calendar plugin ID

The first polling URL must point to the **Google Calendar** plugin's ID, not the private plugin's ID. Find it from the Google Calendar plugin's settings URL:

```
https://usetrmnl.com/plugin_settings/12345/edit
                                     ^^^^^
                                  this number
```

Your first polling URL should be: `https://usetrmnl.com/api/plugin_settings/12345/data`

### Double JSON encoding

Sometimes TRMNL stores the calendar API response as a JSON string rather than a parsed object, resulting in a string-inside-a-string. The plugin handles this automatically (it retries parsing if the first result is a string), but if the diagnostic overlay mentions "Type after parse: string", this is the cause and may indicate a deeper issue.

### Inspect raw calendar data

To see exactly what the calendar API returns, open your browser's **Developer Tools** (F12) > **Console** and run:

```javascript
fetch('https://usetrmnl.com/api/plugin_settings/YOUR_CALENDAR_ID/data', {
  headers: { 'Authorization': 'bearer YOUR_API_KEY' }
})
.then(r => r.json())
.then(data => {
  console.log('Full response:', JSON.stringify(data, null, 2));

  const events = data?.data?.events || data?.events;
  if (!events) {
    console.error('No "events" found. Top-level keys:', Object.keys(data));
    if (data?.data) console.error('data.data keys:', Object.keys(data.data));
  } else {
    console.log('Events count:', events.length);
    if (events.length > 0) {
      console.log('First event sample:', JSON.stringify(events[0], null, 2));
    }
  }

  const names = data?.data?.calendar_names || data?.calendar_names;
  console.log('Calendar names map:', names);
})
.catch(err => console.error('Fetch failed:', err));
```

Replace `YOUR_CALENDAR_ID` with the Google Calendar plugin setting ID and `YOUR_API_KEY` with your key from [trmnl.com/account](https://trmnl.com/account).

**What to look for:**
- Empty response or error: wrong API key or plugin ID
- Empty `events` array `[]`: no calendars selected or wrong layout
- Events missing `start_full`, `end_full`, or `date_time` fields: API format may have changed

### Still no calendar data?

1. Try disconnecting and reconnecting your Google account in the Google Calendar plugin
2. Create a test event on today's date to confirm data flows through
3. Check if the issue is specific to certain calendars or all calendars
4. Wait a few minutes after changes to the Google Calendar plugin, then Force Refresh

---

## Weather not working

### Check the Open-Meteo forecast URL

Open your weather URL directly in a browser (no authentication needed):

```
https://api.open-meteo.com/v1/forecast?latitude=YOUR_LAT&longitude=YOUR_LON&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max&hourly=temperature_2m,precipitation_probability&current=temperature_2m&timezone=YOUR_TIMEZONE&forecast_days=7
```

You should see a JSON response with `daily`, `hourly`, and `current` objects. If not, check:

- **Latitude/longitude** are valid numbers (e.g., `41.39` / `2.17` for Barcelona)
- **Timezone** is a valid IANA timezone (e.g., `Europe/Madrid`, `America/New_York`)
- No extra spaces or line breaks in the URL

Find your coordinates at [open-meteo.com](https://open-meteo.com/en/docs).

### Verify it's the second polling URL

The weather URL must be the **second line** in your private plugin's polling URLs (it maps to IDX_1). If the order is wrong, the plugin will try to parse calendar data as weather and vice versa.

---

## Air quality not working

### Check the Open-Meteo air quality URL

Open your air quality URL directly in a browser (no authentication needed):

```
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=YOUR_LAT&longitude=YOUR_LON&current=european_aqi&timezone=YOUR_TIMEZONE
```

You should see a JSON response with a `current` object containing `european_aqi`. If not, check:

- The URL uses `air-quality-api.open-meteo.com`, not `api.open-meteo.com`
- Latitude, longitude, and timezone match your weather URL

### Air quality is optional

If you don't need AQI data, you can remove the third polling URL entirely. The plugin works fine without it.

### Verify it's the third polling URL

The air quality URL must be the **third line** in your private plugin's polling URLs (it maps to IDX_2). The order of all three URLs matters.

---

## Polling configuration issues

If none of the three data sources are working, the problem is likely in the private plugin's polling setup.

### Check the polling configuration

1. Go to your **Calendar + Weather** private plugin settings
2. Verify:
   - **Polling URLs** are one per line, in the correct order (calendar, weather, air quality)
   - **Polling Verb** is `GET`
   - **Polling Headers** contain `authorization=bearer YOUR_API_KEY`

### Common mistakes

- Wrong `plugin_setting_id` in the calendar URL (using the private plugin's ID instead of the Google Calendar plugin's ID)
- Missing or incorrect API key in headers
- Extra spaces or line breaks in URLs
- Polling URLs in the wrong order (must be: calendar, weather, air quality)

---

## Data format reference

The plugin expects this structure from the calendar API (IDX_0):

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
