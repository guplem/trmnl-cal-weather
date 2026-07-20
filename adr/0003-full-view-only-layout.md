# Full-view-only layout

## Context

TRMNL plugins can provide four view templates: full, half-horizontal, half-vertical, and quadrant. The weekly time-grid this plugin renders packs seven day columns, an hourly weather axis, and a legend row into the display. That information does not fit legibly in a half or quadrant view.

## Decision

Support the full view only. `src/full.liquid` holds the entire render. `src/half_horizontal.liquid`, `src/half_vertical.liquid`, and `src/quadrant.liquid` are short stub templates that render a centered "designed for full screen view only" message instead of a broken layout. The plugin is documented as full-view-only (TRMNL OG, 800x480).

**Rejected alternative:** responsive layouts for the smaller views. Rejected because a seven-day time-grid with weather cannot be shown usefully at half or quadrant size, and maintaining three more layouts would cost far more than the value of a cramped, hard-to-read view.

## Consequences

**Positive:**

- One template to maintain; no effort spent on layouts that could not be read anyway.
- A user who adds the plugin to a smaller slot sees a clear message, not a broken render.

**Trade-offs:**

- The plugin cannot share a screen with another plugin in a half or quadrant slot.
