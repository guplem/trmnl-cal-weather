import { describe, it, expect } from "bun:test";
import { toMin, layoutOverlaps } from "./eventLayout.js";

// Characterization tests: they pin the CURRENT behavior of the helpers that are
// also inlined in src/full.liquid. Do not "fix" the code to make a nicer
// assertion; the rendered layout depends on this exact output.

describe("toMin", () => {
  it("prefers the start_full ISO timestamp", () => {
    expect(toMin("", "2026-04-09T08:55:00.000+02:00")).toBe(535);
  });

  it("ignores a short (<=16 char) fullField and falls back to startField", () => {
    expect(toMin("09:30", "2026-04-09T08:55")).toBe(570);
  });

  it("parses a bare HH:MM start field", () => {
    expect(toMin("09:30", "")).toBe(570);
  });

  it("parses AM times", () => {
    expect(toMin("9:00 AM", "")).toBe(540);
  });

  it("maps 12 AM (midnight) to 0", () => {
    expect(toMin("12:00 AM", "")).toBe(0);
  });

  it("keeps 12 PM (noon) at 720", () => {
    expect(toMin("12:30 PM", "")).toBe(750);
  });

  it("adds 12 hours for afternoon PM times", () => {
    expect(toMin("1:15 PM", "")).toBe(795);
  });

  it("returns -1 when there is no usable time", () => {
    expect(toMin("", "")).toBe(-1);
    expect(toMin(null, null)).toBe(-1);
  });
});

describe("layoutOverlaps", () => {
  it("keeps non-overlapping events in one column each", () => {
    const evts = [{ sm: 0, em: 60 }, { sm: 120, em: 180 }];
    layoutOverlaps(evts);
    expect(evts.every((e) => e.col === 0)).toBe(true);
    expect(evts.every((e) => e.totalCols === 1)).toBe(true);
  });

  it("packs two overlapping events into two side-by-side columns", () => {
    const a = { sm: 0, em: 60 };
    const b = { sm: 30, em: 90 };
    const evts = [b, a]; // out of order on purpose; layoutOverlaps sorts
    layoutOverlaps(evts);
    expect(a.col).toBe(0);
    expect(b.col).toBe(1);
    expect(a.totalCols).toBe(2);
    expect(b.totalCols).toBe(2);
  });

  it("reuses a freed column when a later event starts after an earlier one ends", () => {
    const a = { sm: 0, em: 60 };
    const b = { sm: 30, em: 90 };
    const c = { sm: 60, em: 120 }; // overlaps b, but a has ended -> reuse col 0
    const evts = [a, b, c];
    layoutOverlaps(evts);
    expect(c.col).toBe(0);
    expect(evts.every((e) => e.totalCols === 2)).toBe(true);
  });
});
