import { describe, it, expect } from "bun:test";
import { sanitizeJson, parseLiquid, hasCalData, deepParse } from "./jsonRecovery.js";

// Characterization tests pinning the behavior also inlined in src/full.liquid.

describe("sanitizeJson", () => {
  it("escapes a literal newline into a JSON newline escape", () => {
    expect(sanitizeJson("a\nb")).toBe("a\\nb");
  });

  it("escapes tabs and carriage returns", () => {
    expect(sanitizeJson("a\tb\rc")).toBe("a\\tb\\rc");
  });

  it("drops other control characters", () => {
    expect(sanitizeJson("x\x07y")).toBe("xy");
  });
});

describe("parseLiquid", () => {
  it("converts Ruby-hash arrow syntax before parsing", () => {
    expect(parseLiquid('{"a" => 1}')).toEqual({ a: 1 });
  });

  it("parses a value that contains a literal newline (sanitize makes it valid, parse restores it)", () => {
    expect(parseLiquid('{"note" => "line1\nline2"}')).toEqual({ note: "line1\nline2" });
  });
});

describe("hasCalData", () => {
  it("is truthy when events sit at data.events", () => {
    expect(hasCalData({ data: { events: [1] } })).toBeTruthy();
  });

  it("is truthy when events sit at the top level", () => {
    expect(hasCalData({ events: [] })).toBeTruthy();
  });

  it("is falsy for an object without events", () => {
    expect(hasCalData({ foo: 1 })).toBeFalsy();
  });

  it("is falsy for non-objects", () => {
    expect(hasCalData(null)).toBeFalsy();
    expect(hasCalData("string")).toBeFalsy();
  });
});

describe("deepParse", () => {
  it("returns null for null input", () => {
    expect(deepParse(null)).toBeNull();
  });

  it("parses a single-encoded JSON string", () => {
    expect(deepParse('{"events":[1]}')).toEqual({ events: [1] });
  });

  it("recovers a triple-encoded payload (string inside string)", () => {
    const raw = JSON.stringify(JSON.stringify({ events: [1] }));
    expect(deepParse(raw)).toEqual({ events: [1] });
  });

  it("unwraps a payload nested one level deep", () => {
    const wrapped = { plugin_setting: { data: { events: [1] } } };
    expect(deepParse(wrapped)).toEqual({ data: { events: [1] } });
  });

  it("returns null for an unparseable string", () => {
    expect(deepParse("not json")).toBeNull();
  });

  it("returns null for a non-object, non-string value", () => {
    expect(deepParse(123)).toBeNull();
  });
});
