import { describe, it, expect } from "bun:test";
import { dayInfo, calKey } from "./dateLabels.js";

// Characterization tests pinning the behavior also inlined in src/full.liquid.

describe("dayInfo", () => {
  it("returns the weekday abbreviation and day-of-month", () => {
    // 2026-04-09 is a Thursday.
    expect(dayInfo("2026-04-09")).toEqual({ dn: "Thu", dd: 9 });
  });

  it("parses the day-of-month as a number", () => {
    expect(dayInfo("2026-12-25").dd).toBe(25);
  });
});

describe("calKey", () => {
  it("maps an ISO date to a 'Month DD' key, keeping the zero-padded day", () => {
    expect(calKey("2026-04-09")).toBe("April 09");
  });

  it("uses the full month name", () => {
    expect(calKey("2026-12-25")).toBe("December 25");
  });
});
