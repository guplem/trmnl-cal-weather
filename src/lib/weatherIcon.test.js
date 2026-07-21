import { describe, it, expect } from "bun:test";
import { wIcon } from "./weatherIcon.js";

// Characterization tests pinning the behavior also inlined in src/full.liquid.

describe("wIcon", () => {
  it("always returns an SVG string", () => {
    for (const code of [0, 3, 45, 61, 71, 95]) {
      expect(wIcon(code).startsWith("<svg")).toBe(true);
    }
  });

  it("returns the sun icon for clear codes (<=1)", () => {
    expect(wIcon(0)).toContain('<circle cx="12" cy="12" r="4"');
  });

  it("returns the cloud icon for cloudy codes (2-3)", () => {
    expect(wIcon(3)).toContain('M17.5 19H9');
  });

  it("returns the fog icon for codes 45-48", () => {
    expect(wIcon(45)).toContain('<line x1="3" y1="6"');
  });

  it("returns the drizzle icon for code 80", () => {
    expect(wIcon(80)).toContain('x2="7.5"');
  });

  it("returns the rain icon for codes 61-67", () => {
    expect(wIcon(61)).toContain('x1="7" y1="19" x2="6" y2="22"');
  });

  it("returns the snow icon for codes 71-77", () => {
    expect(wIcon(71)).toContain('<circle cx="8" cy="20" r="0.5"');
  });

  it("returns the thunderstorm icon for codes >=95", () => {
    expect(wIcon(99)).toContain('<polyline');
  });

  it("coerces string and missing codes (falls back to sun for 0)", () => {
    expect(wIcon("2")).toContain('M17.5 19H9'); // cloud
    expect(wIcon(undefined)).toContain('<circle cx="12" cy="12" r="4"'); // NaN -> 0 -> sun
  });
});
