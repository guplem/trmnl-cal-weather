// Pure helpers copied verbatim from the Apps Script middleware
// `src/middleware/calendar_weather_proxy.gs`. The .gs runs on Google Apps
// Script and cannot be imported here, so these copies are the tested source of
// truth; the .gs keeps its own copy and the two MUST stay in sync (see
// src/middleware/AGENTS.md and
// adr/0006-extracted-testable-helpers-with-inline-copies.md).
//
// `cleanText` reads CONFIG.maxTextLength in the .gs; here the limit is a
// parameter so the function is pure.

/**
 * Strip HTML tags, collapse whitespace, and truncate to a maximum length,
 * appending "..." when truncated.
 * @param {string} text - raw text, may contain HTML
 * @param {number} maxTextLength - truncation limit (CONFIG.maxTextLength in the .gs)
 * @returns {string}
 */
export function cleanText(text, maxTextLength) {
  if (!text) return '';
  const stripped = String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > maxTextLength
    ? stripped.substring(0, maxTextLength) + '...'
    : stripped;
}

/**
 * Build the per-location cache key so different coordinates never mix responses.
 * @param {string} source - "cal", "weather", or "aqi"
 * @param {{lat:string|number, lon:string|number, tz:string}} location
 * @returns {string}
 */
export function cacheKey(source, location) {
  return source + ':' + location.lat + ',' + location.lon + ',' + location.tz;
}

/**
 * Build the Open-Meteo forecast URL for a location.
 * @param {{lat:string|number, lon:string|number, tz:string}} location
 * @returns {string}
 */
export function forecastUrl(location) {
  return 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=' + encodeURIComponent(location.lat) +
    '&longitude=' + encodeURIComponent(location.lon) +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset,uv_index_max' +
    '&hourly=temperature_2m,precipitation_probability' +
    '&current=temperature_2m' +
    '&timezone=' + encodeURIComponent(location.tz) +
    '&forecast_days=7';
}
