// Pure ignored-event matching. This module is the single source; the build
// step (build.mjs, `bun run build`) inlines it into the generated
// `src/full.liquid`. `isIgnoredEvent` takes the compiled phrases as a parameter
// so it stays pure; the build emits it as `isIgnoredEventPure` plus a wrapper
// `isIgnoredEvent(ev)` that binds the template's IGNORED_PHRASES, and the
// template's IGNORED_PHRASES is built by calling `compileIgnoredPhrases`. Never
// edit the generated copy. See src/AGENTS.md and
// adr/0006-extracted-testable-helpers-with-inline-copies.md.

/**
 * Compile a comma-separated "Ignored phrases" string into case-insensitive
 * regular expressions. An invalid regex is escaped and matched as literal text.
 * Empty entries are dropped.
 * @param {string} raw - comma-separated patterns, e.g. "^Work$, Focus Time"
 * @returns {RegExp[]} one RegExp per non-empty pattern
 */
export function compileIgnoredPhrases(raw) {
  return String(raw)
    .split(',')
    .map(function(s){ return s.trim(); })
    .filter(function(s){ return s.length > 0; })
    .map(function(p){
      try { return new RegExp(p, 'i'); }
      catch(e) { return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
    });
}

/**
 * Return true when the event's title or description matches any ignored phrase.
 * @param {{summary?:string, description?:string}} ev - the calendar event
 * @param {RegExp[]} ignoredPhrases - compiled by compileIgnoredPhrases
 * @returns {boolean}
 */
export function isIgnoredEvent(ev, ignoredPhrases) {
  for (var i = 0; i < ignoredPhrases.length; i++) {
    if (ignoredPhrases[i].test(ev.summary || '') || ignoredPhrases[i].test(ev.description || '')) return true;
  }
  return false;
}
