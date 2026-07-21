# Design to the 4-shade 2-bit grayscale palette

## Context

The target device is the TRMNL (OG) with the 2-bit grayscale palette enabled (firmware >= 1.6.0). A 2-bit display has four native shades: #000, #555, #AAA, and #fff. Any other color is approximated with Floyd-Steinberg dithering (a pattern of dots that fakes a shade), which looks noisy and muddy on an e-ink calendar full of thin lines and small text.

## Decision

Use only the four native hex shades (#000, #555, #AAA, #fff) for every color in `full.liquid` (backgrounds, text, borders, event bars, weather icons). Distinguish calendars by grayscale bar patterns (solid, striped, bordered) rather than by color. Weather icon SVGs use white fill for opaque shapes so they read against the grid.

**Rejected alternative:** a richer color palette. Rejected because non-native colors are dithered on the 2-bit display, degrading the legibility of thin grid lines and small event text; grayscale patterns carry the same information cleanly.

## Consequences

**Positive:**

- Crisp rendering with no dithering artifacts; predictable output.

**Trade-offs:**

- Calendars are told apart by pattern, not color, capped at the 11 distinct bar patterns.
- Any new visual element must be expressed within four shades; check new colors against this list, or they will dither.
