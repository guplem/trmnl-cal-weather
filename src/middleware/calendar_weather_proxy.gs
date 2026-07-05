/**
 * TRMNL Calendar + Weather middleware (Google Apps Script).
 *
 * A single web app that serves all three data sources the private plugin
 * polls, replacing both the TRMNL Google Calendar plugin and the direct
 * Open-Meteo calls:
 *
 *   YOUR_SCRIPT_URL?token=...&src=cal&tz=Europe/Madrid
 *   YOUR_SCRIPT_URL?token=...&src=weather&lat=41.39&lon=2.17&tz=Europe/Madrid
 *   YOUR_SCRIPT_URL?token=...&src=aqi&lat=41.39&lon=2.17&tz=Europe/Madrid
 *
 * Location and timezone always come from the URL parameters (filled by the
 * TRMNL plugin form fields); the script holds no per-user location config.
 * Required parameters: `tz` for all sources, plus `lat`/`lon` for
 * weather/aqi. Requests missing them get an {error: ...} response.
 *
 * Why it exists:
 *   - TRMNL pauses the Google Calendar plugin's data sync while that plugin
 *     is hidden in a playlist, so events polled from its /data endpoint go
 *     stale. This script reads the calendars directly from the Google account
 *     that owns it, so there is no TRMNL-side sync left to stall.
 *   - TRMNL's polling timeout is 30s and Open-Meteo occasionally takes
 *     longer, which degrades the whole plugin. Open-Meteo responses here are
 *     served from a cache kept warm by a time-driven trigger, so TRMNL always
 *     gets an instant answer (and the last good copy if Open-Meteo is down).
 *
 * The ?src=cal response mimics the JSON shape of TRMNL's calendar /data
 * endpoint (see "Data format reference" in TROUBLESHOOTING.md), so the
 * Liquid template works completely unchanged.
 *
 * Setup: see MIDDLEWARE_SETUP.md in the repo root.
 */

const CONFIG = {
  // Shared secret. Every polling URL must include token=<this value>.
  // Use a long random string (40+ characters).
  token: 'YOUR_SECRET_TOKEN',

  // Calendar window: today .. today + daysAhead. The template renders 7
  // days; the extra buffer is cheap and avoids edge cases around midnight.
  daysAhead: 10,

  // [] = every calendar that is checked ("selected") in the Google Calendar
  // UI of the account that owns this script. To pin specific calendars,
  // list their IDs, e.g.:
  //   ['you@gmail.com', 'partner@gmail.com', 'xyz@group.calendar.google.com']
  calendarIds: [],

  // Sent to the template as first_day. 0 = Sunday, 1 = Monday.
  firstDayOfWeek: 1,

  // Skip events you have declined (RSVP "No") in Google Calendar.
  hideDeclinedEvents: true,

  // Truncate description/location so the payload stays well under TRMNL's
  // data size limit (oversized payloads get cut mid-stream and fail to parse).
  maxTextLength: 200,

  // How long a cached Open-Meteo response stays servable if the API keeps
  // failing. 21600s (6h) is the CacheService maximum; the 15-minute trigger
  // normally overwrites the cache long before it expires.
  cacheMaxAgeSeconds: 21600
};

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";

function forecastUrl(location) {
  return 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + encodeURIComponent(location.lat) +
    '&longitude=' + encodeURIComponent(location.lon) +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max' +
    '&hourly=temperature_2m,precipitation_probability' +
    '&current=temperature_2m' +
    '&timezone=' + encodeURIComponent(location.tz) +
    '&forecast_days=7';
}

function airQualityUrl(location) {
  return 'https://air-quality-api.open-meteo.com/v1/air-quality' +
    '?latitude=' + encodeURIComponent(location.lat) +
    '&longitude=' + encodeURIComponent(location.lon) +
    '&current=european_aqi' +
    '&timezone=' + encodeURIComponent(location.tz);
}

// === WEB APP ENTRY POINT ===

function doGet(request) {
  const params = (request && request.parameter) || {};
  if (!CONFIG.token || CONFIG.token === 'YOUR_SECRET_TOKEN') {
    return jsonResponse({ error: 'middleware not configured: set CONFIG.token' });
  }
  if (params.token !== CONFIG.token) {
    return jsonResponse({ error: 'unauthorized' });
  }

  const source = params.src || 'cal';
  if (source === 'cal') {
    if (!params.tz) {
      return jsonResponse({ error: 'missing tz parameter (IANA timezone, e.g. Europe/Madrid)' });
    }
    return jsonResponse(buildCalendarPayload(params.tz));
  }
  if (source === 'weather' || source === 'aqi') {
    if (!params.lat || !params.lon || !params.tz) {
      return jsonResponse({ error: 'missing lat/lon/tz parameters' });
    }
    const location = { lat: params.lat, lon: params.lon, tz: params.tz };
    rememberLocation(location);
    const url = source === 'weather' ? forecastUrl(location) : airQualityUrl(location);
    return jsonResponse(serveCached(cacheKey(source, location), url));
  }
  return jsonResponse({ error: 'unknown src: ' + source });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// === CALENDAR (?src=cal) ===

function buildCalendarPayload(tz) {
  // Derive "today at midnight" via formatDate so the window is correct even
  // if the script project timezone differs from the requested tz.
  const todayParts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-');
  const windowStart = new Date(+todayParts[0], +todayParts[1] - 1, +todayParts[2]);
  const windowEnd = new Date(windowStart.getTime() + CONFIG.daysAhead * 24 * 60 * 60 * 1000);

  const events = [];
  const calendarNames = {};
  getConfiguredCalendars().forEach(function (calendar) {
    try {
      const calendarId = calendar.getId();
      calendarNames[calendarId] = calendar.getName();
      calendar.getEvents(windowStart, windowEnd).forEach(function (event) {
        if (isDeclinedByMe(event)) return;
        events.push(formatEvent(event, calendarId, tz));
      });
    } catch (err) {
      // One unreadable calendar (revoked share, deleted, etc.) must not take
      // down the whole payload; the remaining calendars still render.
    }
  });

  return {
    data: {
      events: events,
      calendar_names: calendarNames,
      today_in_tz: Utilities.formatDate(new Date(), tz, ISO_FORMAT),
      first_day: CONFIG.firstDayOfWeek
    }
  };
}

function getConfiguredCalendars() {
  if (CONFIG.calendarIds.length > 0) {
    return CONFIG.calendarIds
      .map(function (id) { return CalendarApp.getCalendarById(id); })
      .filter(function (calendar) { return calendar !== null; });
  }
  return CalendarApp.getAllCalendars().filter(function (calendar) {
    return calendar.isSelected();
  });
}

// getMyStatus() is the RSVP of the account that owns this script: YES, NO,
// MAYBE, INVITED, OWNER, or null when that account is not a guest (e.g. an
// event on someone else's shared calendar). Only an explicit NO is filtered,
// so events without an RSVP always stay visible.
function isDeclinedByMe(event) {
  if (!CONFIG.hideDeclinedEvents) return false;
  try {
    return event.getMyStatus() === CalendarApp.GuestStatus.NO;
  } catch (err) {
    return false; // an unreadable status must never hide the event
  }
}

// Same field names as TRMNL's calendar /data endpoint so the template needs
// no changes. For all-day events Google's end is exclusive (midnight after
// the last day), which is exactly what the template's expansion loop expects.
function formatEvent(event, calendarId, tz) {
  const startFull = Utilities.formatDate(event.getStartTime(), tz, ISO_FORMAT);
  return {
    summary: event.getTitle(),
    description: cleanText(event.getDescription()),
    location: cleanText(event.getLocation()),
    all_day: event.isAllDayEvent(),
    start_full: startFull,
    end_full: Utilities.formatDate(event.getEndTime(), tz, ISO_FORMAT),
    date_time: startFull,
    calname: calendarId
  };
}

// Strip HTML tags (Google descriptions may contain them), collapse
// whitespace, and truncate to keep the payload small.
function cleanText(text) {
  if (!text) return '';
  const stripped = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > CONFIG.maxTextLength
    ? stripped.substring(0, CONFIG.maxTextLength) + '...'
    : stripped;
}

// === OPEN-METEO PROXY (?src=weather, ?src=aqi) ===

// The cache is per-location so different coordinates never mix responses.
function cacheKey(source, location) {
  return source + ':' + location.lat + ',' + location.lon + ',' + location.tz;
}

// Serve from cache when possible; only on a cold cache (first call ever, or
// nothing cached for 6h+) does TRMNL's request wait on a live Open-Meteo call.
function serveCached(key, url) {
  const cachedText = CacheService.getScriptCache().get(key);
  if (cachedText) return JSON.parse(cachedText);
  return fetchAndCache(key, url);
}

function fetchAndCache(key, url) {
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      const text = response.getContentText();
      const parsed = JSON.parse(text); // validate before caching
      CacheService.getScriptCache().put(key, text, CONFIG.cacheMaxAgeSeconds);
      return parsed;
    }
  } catch (err) {
    // Fall through: a failed fetch must not overwrite an existing good cache.
  }
  return { error: 'upstream fetch failed for ' + key + ' and no cached copy exists' };
}

// Store the most recently requested location so the time-driven trigger
// warms the cache for the same coordinates TRMNL actually polls.
function rememberLocation(location) {
  const properties = PropertiesService.getScriptProperties();
  const serialized = JSON.stringify(location);
  if (properties.getProperty('last_location') !== serialized) {
    properties.setProperty('last_location', serialized);
  }
}

function lastRequestedLocation() {
  const stored = PropertiesService.getScriptProperties().getProperty('last_location');
  return stored ? JSON.parse(stored) : null;
}

// Attach a time-driven trigger (every 15 minutes) to this function so the
// Open-Meteo cache is always warm: see MIDDLEWARE_SETUP.md, Step 8.
// It does nothing until the first weather/aqi request has been served.
function refreshUpstreamCaches() {
  const location = lastRequestedLocation();
  if (!location) return;
  fetchAndCache(cacheKey('weather', location), forecastUrl(location));
  fetchAndCache(cacheKey('aqi', location), airQualityUrl(location));
}

// === MANUAL TEST HELPERS (run from the Apps Script editor) ===

// Run this once after pasting the code: it triggers the permission prompt
// (Calendar + external requests) and logs the payload so you can verify
// your events appear. Uses the project timezone (Project Settings).
function testCalendarPayload() {
  Logger.log(JSON.stringify(buildCalendarPayload(Session.getScriptTimeZone()), null, 2));
}

function testWeatherPayload() {
  const location = lastRequestedLocation();
  if (!location) {
    Logger.log('No location yet: call ?src=weather&lat=..&lon=..&tz=.. once, then re-run');
    return;
  }
  Logger.log(JSON.stringify(serveCached(cacheKey('weather', location), forecastUrl(location)), null, 2));
}
