// Pure WMO-weather-code to SVG icon mapping. SVGs use white fill for opaque
// shapes so they read on the 2-bit e-ink palette. This module is the single
// source; the build step (build.mjs, `bun run build`) inlines it into the
// generated `src/full.liquid`. Never edit that generated copy. See src/AGENTS.md
// and adr/0006-extracted-testable-helpers-with-inline-copies.md.

/**
 * Map a WMO weather code to an inline SVG icon string.
 * @param {number|string} c - WMO weather code
 * @returns {string} an SVG markup string
 */
export function wIcon(c){c=+c||0;
  // Clear/sunny: white-filled sun circle + rays
  if(c<=1)return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="#fff"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="5" y1="5" x2="7" y2="7"/><line x1="17" y1="17" x2="19" y2="19"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="5" y1="19" x2="7" y2="17"/><line x1="17" y1="7" x2="19" y2="5"/></svg>';
  // Cloudy/overcast: white-filled cloud
  if(c<=3)return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/></svg>';
  // Fog: horizontal lines (no fill needed)
  if(c>=45&&c<=48)return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="5" y1="18" x2="19" y2="18"/></svg>';
  // Drizzle/light showers: white-filled cloud + drops
  if((c>=51&&c<=57)||c===80)return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 17H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/><line x1="8" y1="19" x2="7.5" y2="21"/><line x1="13" y1="19" x2="12.5" y2="21"/></svg>';
  // Rain/heavy showers: white-filled cloud + drops
  if((c>=61&&c<=67)||(c>=81&&c<=82))return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 17H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/><line x1="7" y1="19" x2="6" y2="22"/><line x1="11" y1="19" x2="10" y2="22"/><line x1="15" y1="19" x2="14" y2="22"/></svg>';
  // Snow: white-filled cloud + dots
  if((c>=71&&c<=77)||(c>=85&&c<=86))return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 17H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/><circle cx="8" cy="20" r="0.5" fill="#000"/><circle cx="12" cy="20" r="0.5" fill="#000"/><circle cx="16" cy="20" r="0.5" fill="#000"/></svg>';
  // Thunderstorm: white-filled cloud + lightning
  if(c>=95)return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 16H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/><polyline points="13,17 10,21 14,21 11,25" fill="none"/></svg>';
  // Fallback: white-filled cloud
  return'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z" fill="#fff"/></svg>';
}
