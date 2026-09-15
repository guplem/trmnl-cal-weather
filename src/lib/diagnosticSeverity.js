// Pure rule that decides how loud the on-screen diagnostic is. This module is
// the single source; the build step (build.mjs, `bun run build`) inlines it
// into the generated `src/full.liquid`. Never edit that generated copy. See
// src/AGENTS.md and
// adr/0006-extracted-testable-helpers-with-inline-copies.md.

/**
 * True when every collected diagnostic is transient, so one small note is
 * enough and the centered overlay can stay off the calendar grid. A transient
 * diagnostic is one that the next poll clears on its own (a polling slot that
 * delivered nothing). Anything else (a token mismatch, a wrong payload shape)
 * needs a human, so it keeps the full overlay.
 * @param {Array<{transient?: boolean}>} diagnostics
 * @returns {boolean}
 */
export function allDiagnosticsAreTransient(diagnostics) {
  if (!diagnostics || diagnostics.length === 0) return false;
  for (var i = 0; i < diagnostics.length; i++) {
    if (!diagnostics[i].transient) return false;
  }
  return true;
}
