# Troubleshooting

This guide helps debug common issues with the Calendar + Weather plugin, especially when calendar events are not showing up.

## Known Issues

### Double JSON Encoding

The most common cause of "no calendar data" is **double JSON encoding**. When TRMNL polls the calendar API and stores the response, it may store it as a JSON string rather than a parsed object. When the Liquid template renders `{{ IDX_0 | json }}`, this produces a string-inside-a-string that needs two rounds of `JSON.parse` to unwrap.

The plugin handles this automatically (it retries parsing if the first result is a string), but if you see the diagnostic overlay mentioning "Type after parse: string", this is the cause.

### Nested API Response Wrapper

Some TRMNL API responses wrap the calendar data in an extra object (e.g., `{ "plugin_setting": { "data": { "events": [...] } } }`). The plugin searches one level deep for the expected `data.events` structure, but deeper nesting would still fail.

## Quick Diagnostic: On-Screen Error Overlay

The plugin includes a built-in diagnostic overlay. When something goes wrong with the data, a black-bordered message box will appear on the display with details about what failed. Common messages:

| Message | Meaning |
|---------|---------|
| **No data received** | Neither calendar nor weather data was received. The polling URLs may be misconfigured or the API key may be wrong. |
| **Calendar: no data received** | IDX_0 (calendar polling URL) returned empty or unparseable data. |
| **Calendar: unexpected format** | IDX_0 returned data but it doesn't contain the expected `events` array or `data.events` structure. |
| **Calendar: data received but 0 events** | The calendar API responded correctly but the events array is empty. Check that the Google Calendar plugin has calendars selected and is set to "Week" layout. |
| **Weather: no data received** | IDX_1 (weather polling URL) returned empty or unparseable data. Check the Open-Meteo URL for typos. |

The overlay also shows the raw structure of the received data (truncated) to help identify format mismatches.

## Step-by-Step Debugging

### 1. Verify the Google Calendar Plugin

1. Go to [trmnl.com](https://trmnl.com) > **Plugins**
2. Find your **Google Calendar** plugin and open its settings
3. Confirm:
   - Google account is connected (re-authorize if needed)
   - All desired calendars are **selected** (hold Ctrl/Cmd to multi-select)
   - Layout is set to **Week**
4. Note the `plugin_setting_id` from the URL:
   ```
   https://usetrmnl.com/plugin_settings/12345/edit
                                        ^^^^^
   ```

### 2. Check the Raw Calendar Data in Browser Console

This is the most important debugging step. It lets you see exactly what data the calendar API returns.

1. Open your browser and go to: `https://usetrmnl.com/api/plugin_settings/YOUR_CALENDAR_ID/data`
   - Replace `YOUR_CALENDAR_ID` with the plugin_setting_id from Step 1
2. You need to send an authenticated request. Open the browser's **Developer Tools** (F12) > **Console** tab
3. Run this script (replace the two placeholders):

```javascript
fetch('https://usetrmnl.com/api/plugin_settings/YOUR_CALENDAR_ID/data', {
  headers: { 'Authorization': 'bearer YOUR_API_KEY' }
})
.then(r => r.json())
.then(data => {
  console.log('Full response:', JSON.stringify(data, null, 2));
  
  // Check structure
  const events = data?.data?.events || data?.events;
  if (!events) {
    console.error('No "events" found. Top-level keys:', Object.keys(data));
    if (data?.data) console.error('data.data keys:', Object.keys(data.data));
  } else {
    console.log('Events count:', events.length);
    if (events.length > 0) {
      console.log('First event sample:', JSON.stringify(events[0], null, 2));
      console.log('Event fields:', Object.keys(events[0]));
    }
  }
  
  // Check calendar names
  const names = data?.data?.calendar_names || data?.calendar_names;
  console.log('Calendar names map:', names);
})
.catch(err => console.error('Fetch failed:', err));
```

4. Replace `YOUR_CALENDAR_ID` with your Google Calendar plugin's setting ID
5. Replace `YOUR_API_KEY` with your API key from [trmnl.com/account](https://trmnl.com/account)

**What to look for:**
- If the response is empty or an error, the API key or plugin ID is wrong
- If `events` is an empty array `[]`, the Google Calendar plugin has no data (check calendar selection and layout)
- If `events` exists with data, check that each event has `start_full`, `end_full`, `date_time`, `summary`, and `calname` fields
- If the structure is different from expected (e.g., events are nested differently), the API format may have changed

### 3. Check the Private Plugin Polling Configuration

1. Go to your **Calendar + Weather** private plugin settings
2. Verify the **Polling URLs** (one per line):
   - **Line 1**: `https://usetrmnl.com/api/plugin_settings/YOUR_CALENDAR_ID/data`
   - **Line 2**: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...` (weather)
   - **Line 3** (optional): `https://air-quality-api.open-meteo.com/v1/air-quality?...` (AQI)
3. Verify the **Polling Headers**: `authorization=bearer YOUR_API_KEY`
4. Verify the **Polling Verb** is `GET`

**Common mistakes:**
- Wrong `plugin_setting_id` in the calendar URL (using the private plugin's ID instead of the Google Calendar plugin's ID)
- Missing or incorrect API key in headers
- Extra spaces or line breaks in the URL
- Using `Authorization` (capital A) instead of `authorization` (TRMNL headers are case-sensitive in some contexts)

### 4. Check the Weather Data

Open this URL directly in your browser (no auth needed):

```
https://api.open-meteo.com/v1/forecast?latitude=YOUR_LAT&longitude=YOUR_LON&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max&hourly=temperature_2m,precipitation_probability&current=temperature_2m&timezone=YOUR_TIMEZONE&forecast_days=7
```

You should see a JSON response with `daily`, `hourly`, and `current` objects. If not, check:
- Latitude/longitude are valid numbers
- Timezone is a valid IANA timezone (e.g., `Europe/Madrid`, `America/New_York`)

### 5. Force Refresh and Wait

After making changes:
1. Go to the private plugin's settings page
2. Click **Force Refresh**
3. Wait 30-60 seconds for the data to be polled
4. Check if your TRMNL device updates (it may take another polling cycle)

### 6. Check the Rendered Output

If you have access to the TRMNL preview or the device's rendered HTML:
1. Open Developer Tools (F12) > **Console**
2. Look for any JavaScript errors
3. Check the `#cw-container` element in the **Elements** tab to see what was rendered

## Data Format Reference

The plugin expects this structure from the calendar API (IDX_0):

```json
{
  "data": {
    "events": [
      {
        "summary": "Meeting title",
        "start": "9:00 AM",
        "end": "10:00 AM",
        "start_full": "2026-04-17T09:00:00.000+02:00",
        "end_full": "2026-04-17T10:00:00.000+02:00",
        "date_time": "2026-04-17T09:00:00.000+02:00",
        "calname": "user@gmail.com",
        "all_day": false,
        "summary": "Event Title",
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
- `start_full` / `end_full` are ISO timestamps with timezone offset (preferred for time parsing)
- `date_time` is used to determine which date the event belongs to
- `all_day` boolean determines if the event goes in the all-day strip
- `calname` contains an email address, mapped to a display name via `calendar_names`

## Where to Find Logs

TRMNL renders templates server-side (headless browser) and sends the resulting bitmap to the device. This means:

- **JavaScript `console.log` is not visible** on the device or in the TRMNL web UI. The on-screen diagnostic overlay is the primary debugging tool.
- **TRMNL web preview**: Some plugin pages have a "Preview" or rendered output section. Check if the diagnostic overlay is visible there.
- **Polling status**: Check your private plugin's settings page for any polling error indicators. TRMNL may show if a polling URL returned an error status code.
- **Browser DevTools on preview**: If TRMNL provides an HTML preview of your plugin, open it and use F12 > Console to see any JavaScript errors and F12 > Elements to inspect `#cw-container` for the actual rendered HTML.
- **TRMNL support**: If you have access to the TRMNL admin/internal tools, check the polling logs for your plugin to see the raw HTTP response from each polling URL.

## Still Not Working?

If you've verified all the above and events still don't show:
1. Try with a fresh Google Calendar plugin (disconnect and reconnect Google)
2. Create a test event on today's date to confirm data flow
3. Check if the issue is specific to certain calendars or all calendars
4. Compare the raw API response structure with the format reference above
5. Share a screenshot of the diagnostic overlay (if visible) with the plugin author
