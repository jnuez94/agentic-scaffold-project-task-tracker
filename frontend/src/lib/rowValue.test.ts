import { describe, expect, it } from "vitest";
import { list, text } from "./rowValue.ts";

describe("text", () => {
  it("passes strings through", () => {
    expect(text("SEC-1")).toBe("SEC-1");
  });

  it("stringifies values that stringify meaningfully", () => {
    expect(text(3)).toBe("3");
    expect(text(0)).toBe("0");
    expect(text(true)).toBe("true");
    expect(text(10n)).toBe("10");
  });

  it("refuses objects rather than rendering [object Object]", () => {
    // The defect this exists to prevent: an object reaching a heading or title
    // and being shown to the operator as if it were data.
    expect(text({ id: "x" })).toBe("");
    expect(text([1, 2])).toBe("");
    expect(text(() => "x")).toBe("");
  });

  it("uses the fallback for absent values", () => {
    expect(text(null)).toBe("");
    expect(text(undefined)).toBe("");
    expect(text(null, "—")).toBe("—");
  });

  it("does not treat an empty string as absent", () => {
    // "" is a real stored value; replacing it with a fallback would invent one.
    expect(text("", "—")).toBe("");
  });
});

describe("list", () => {
  it("returns the entries of an array", () => {
    expect(list(["UI-1", "UI-2"])).toEqual(["UI-1", "UI-2"]);
  });

  it("returns empty for anything that is not an array", () => {
    expect(list(undefined)).toEqual([]);
    expect(list("UI-1")).toEqual([]);
    expect(list({ 0: "UI-1" })).toEqual([]);
  });

  it("drops entries that are not text-like rather than showing [object Object]", () => {
    expect(list(["UI-1", { nested: true }, "UI-2"])).toEqual(["UI-1", "UI-2"]);
  });
});
