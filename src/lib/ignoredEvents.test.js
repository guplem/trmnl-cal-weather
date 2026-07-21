import { describe, it, expect } from "bun:test";
import { compileIgnoredPhrases, isIgnoredEvent } from "./ignoredEvents.js";

// Characterization tests pinning the behavior also inlined in src/full.liquid.

describe("compileIgnoredPhrases", () => {
  it("compiles one case-insensitive regex per non-empty pattern", () => {
    const rx = compileIgnoredPhrases("^Work$, Focus Time");
    expect(rx).toHaveLength(2);
    expect(rx[0].test("work")).toBe(true); // case-insensitive
  });

  it("drops empty entries", () => {
    expect(compileIgnoredPhrases("")).toHaveLength(0);
    expect(compileIgnoredPhrases("  ,  ")).toHaveLength(0);
  });

  it("treats an invalid regex as literal text instead of throwing", () => {
    const rx = compileIgnoredPhrases("[");
    expect(rx).toHaveLength(1);
    expect(rx[0].test("a[b")).toBe(true);
  });
});

describe("isIgnoredEvent", () => {
  it("matches an anchored pattern against the title", () => {
    const rx = compileIgnoredPhrases("^Work$");
    expect(isIgnoredEvent({ summary: "Work" }, rx)).toBe(true);
    expect(isIgnoredEvent({ summary: "Workshop" }, rx)).toBe(false);
  });

  it("matches against the description too", () => {
    const rx = compileIgnoredPhrases("Focus Time");
    expect(isIgnoredEvent({ summary: "", description: "my Focus Time block" }, rx)).toBe(true);
  });

  it("returns false when there are no phrases", () => {
    expect(isIgnoredEvent({ summary: "Anything" }, [])).toBe(false);
  });
});
