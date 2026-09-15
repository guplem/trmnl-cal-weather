// Characterization tests for the rule that decides how loud a diagnostic is.
import { describe, it, expect } from "bun:test";
import { allDiagnosticsAreTransient } from "./diagnosticSeverity.js";

describe("allDiagnosticsAreTransient", () => {
  it("is true when every entry is marked transient (a poll that delivered nothing)", () => {
    expect(allDiagnosticsAreTransient([
      { label: "Weather: poll delivered no data", detail: "...", transient: true }
    ])).toBe(true);
  });

  it("is false when one entry is not transient, so the full overlay still shows", () => {
    expect(allDiagnosticsAreTransient([
      { label: "Weather: poll delivered no data", detail: "...", transient: true },
      { label: "Calendar: API error", detail: "unauthorized" }
    ])).toBe(false);
  });

  it("is false for no diagnostics at all (nothing to show)", () => {
    expect(allDiagnosticsAreTransient([])).toBe(false);
    expect(allDiagnosticsAreTransient(null)).toBe(false);
    expect(allDiagnosticsAreTransient(undefined)).toBe(false);
  });
});
