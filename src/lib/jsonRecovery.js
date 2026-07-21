// Pure JSON recovery helpers: they repair the triple-encoded / Ruby-hash JSON
// that TRMNL and trmnlp can deliver, and unwrap the calendar payload. This
// module is the single source; the build step (build.mjs, `bun run build`)
// inlines it into the generated `src/full.liquid`. Never edit that generated
// copy. See src/AGENTS.md and
// adr/0006-extracted-testable-helpers-with-inline-copies.md.

/**
 * Escape the control characters that break JSON.parse (literal newlines/tabs
 * in event descriptions or locations); drop other control characters.
 * @param {string} s
 * @returns {string}
 */
export function sanitizeJson(s) {
  return s.replace(/[\x00-\x1f\x7f]/g, function(c) {
    switch(c) {
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\t': return '\\t';
      default: return '';
    }
  });
}

/**
 * Parse a Liquid-encoded JSON string: trmnlp's `json` filter emits Ruby hash
 * syntax (` => ` instead of `: `), so convert it before parsing.
 * @param {string} str
 * @returns {*} the parsed value
 */
export function parseLiquid(str) { return JSON.parse(sanitizeJson(str.replace(/ => /g, ': '))); }

/**
 * True when the object holds calendar events at `data.events` or `events`.
 * @param {*} obj
 * @returns {boolean}
 */
export function hasCalData(obj) { return obj && typeof obj === 'object' && ((obj.data && obj.data.events) || obj.events); }

/**
 * Recover the calendar payload from raw data that may be double- or
 * triple-encoded JSON (a string inside a string) and may wrap the events one
 * level deep. Returns the object that holds the events, or null when the raw
 * value cannot be parsed into an object at all.
 * @param {*} raw
 * @returns {object|null}
 */
export function deepParse(raw) {
  if (raw == null) return null;
  // If first parse returned a string, try parsing it again (double-encoded JSON)
  if (typeof raw === 'string') { try { raw = JSON.parse(sanitizeJson(raw)); } catch(e) { return null; } }
  if (typeof raw === 'string') { try { raw = JSON.parse(sanitizeJson(raw)); } catch(e) { return null; } } // triple-encoded edge case
  if (typeof raw !== 'object' || raw === null) return null;
  // If data is at expected path, return as-is
  if (hasCalData(raw)) return raw;
  // Search one level deeper for a wrapper (e.g., { "plugin_setting": { "data": { "events": [...] } } })
  var keys = Object.keys(raw);
  for (var i = 0; i < keys.length; i++) {
    var child = raw[keys[i]];
    if (child && typeof child === 'object' && hasCalData(child)) return child;
  }
  return raw; // return whatever we have; diagnostics will flag it if still bad
}
