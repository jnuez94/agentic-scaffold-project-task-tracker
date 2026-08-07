import { describe, expect, it } from "vitest";
import {
  isMultiPath,
  NOT_VERIFIED,
  NOT_VERIFIED_MANY,
  notVerifiedNote,
  pathSummary,
  splitPaths,
} from "./artifactPaths.ts";

describe("splitPaths", () => {
  it("returns a single path unchanged", () => {
    expect(splitPaths("docs/spec.md")).toEqual(["docs/spec.md"]);
  });

  it("splits the comma-separated form 3 of 15 artifacts actually use", () => {
    expect(splitPaths("docs/a.md,docs/b.md,docs/c.md")).toEqual([
      "docs/a.md",
      "docs/b.md",
      "docs/c.md",
    ]);
  });

  it("trims the spacing people put after commas", () => {
    expect(splitPaths("docs/a.md, docs/b.md")).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("drops empty segments from a trailing or doubled comma", () => {
    expect(splitPaths("docs/a.md,,docs/b.md,")).toEqual(["docs/a.md", "docs/b.md"]);
  });

  it("returns nothing for an empty or absent field", () => {
    expect(splitPaths("")).toEqual([]);
    expect(splitPaths("   ")).toEqual([]);
    expect(splitPaths(null)).toEqual([]);
    expect(splitPaths(undefined)).toEqual([]);
  });

  it("returns nothing rather than guessing for a non-string", () => {
    expect(splitPaths(42)).toEqual([]);
    expect(splitPaths(["docs/a.md"])).toEqual([]);
  });

  it("preserves recorded order and duplicates", () => {
    // This is a record of what someone wrote. Sorting or deduplicating would
    // make the console disagree with the CLI about the field's contents.
    expect(splitPaths("b.md,a.md,b.md")).toEqual(["b.md", "a.md", "b.md"]);
  });

  it("leaves a URL intact rather than splitting inside it", () => {
    expect(splitPaths("https://example.com/a")).toEqual(["https://example.com/a"]);
  });
});

describe("isMultiPath", () => {
  it("is false for one path and for none", () => {
    expect(isMultiPath("docs/a.md")).toBe(false);
    expect(isMultiPath("")).toBe(false);
  });

  it("is true only once there are genuinely two", () => {
    expect(isMultiPath("docs/a.md,docs/b.md")).toBe(true);
    // A trailing comma is not a second path.
    expect(isMultiPath("docs/a.md,")).toBe(false);
  });
});

describe("notVerifiedNote", () => {
  it("uses Michael's wording verbatim for a single path", () => {
    expect(notVerifiedNote("docs/a.md")).toBe(NOT_VERIFIED);
    expect(NOT_VERIFIED).toBe("Recorded path. The console does not check whether it exists.");
  });

  it("agrees in number when the field holds a list", () => {
    expect(notVerifiedNote("a.md,b.md")).toBe(NOT_VERIFIED_MANY);
  });

  it("never claims the console verified anything", () => {
    for (const note of [NOT_VERIFIED, NOT_VERIFIED_MANY]) {
      expect(note).toMatch(/does not check/);
    }
  });
});

describe("pathSummary", () => {
  it("reports the first path and no extras for a single one", () => {
    expect(pathSummary("docs/a.md")).toEqual({ first: "docs/a.md", extra: 0 });
  });

  it("counts the remainder rather than listing it", () => {
    // The column must not grow rows the way UI-44's tags did.
    expect(pathSummary("a.md,b.md,c.md")).toEqual({ first: "a.md", extra: 2 });
  });

  it("reports nothing for an empty field", () => {
    expect(pathSummary("")).toEqual({ first: "", extra: 0 });
    expect(pathSummary(null)).toEqual({ first: "", extra: 0 });
  });
});
