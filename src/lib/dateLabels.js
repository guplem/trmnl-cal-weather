// Pure date-to-label helpers. This module is the single source; the build step
// (build.mjs, `bun run build`) inlines it into the generated `src/full.liquid`.
// Never edit that generated copy. See src/AGENTS.md and
// adr/0006-extracted-testable-helpers-with-inline-copies.md.

var DA=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MN2=["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * Map an ISO date (YYYY-MM-DD) to its weekday abbreviation and day-of-month.
 * @param {string} iso - e.g. "2026-04-09"
 * @returns {{dn:string, dd:number}} weekday abbreviation and day-of-month
 */
export function dayInfo(iso){var p=iso.split("-");var d=new Date(+p[0],+p[1]-1,+p[2]);return{dn:DA[d.getDay()],dd:+p[2]};}

/**
 * Map an ISO date (YYYY-MM-DD) to a "Month DD" key, matching the trmnlp mock
 * data grouping (e.g. "April 9").
 * @param {string} iso - e.g. "2026-04-09"
 * @returns {string} e.g. "April 09"
 */
export function calKey(iso){var p=iso.split("-");return MN2[+p[1]-1]+" "+p[2];}
