import { describe, expect, it } from "vitest";
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  isTruncated,
  pageBounds,
  pageCount,
  pageSlice,
  PAGE_SIZES,
  rangeLabel,
} from "./pagination.ts";

describe("pageCount", () => {
  it("counts whole and partial pages", () => {
    expect(pageCount(100, 25)).toBe(4);
    expect(pageCount(101, 25)).toBe(5);
  });

  it("always reports at least one page, so page 1 exists when empty", () => {
    expect(pageCount(0, 25)).toBe(1);
  });

  it("does not divide by zero", () => {
    expect(pageCount(50, 0)).toBe(1);
  });
});

describe("clampPage", () => {
  it("keeps a valid page unchanged", () => {
    expect(clampPage(2, 100, 25)).toBe(2);
  });

  it("pulls a page back when filtering shrinks the set beneath it", () => {
    // On page 4, then a filter leaves 10 rows: page 4 no longer exists.
    expect(clampPage(4, 10, 25)).toBe(1);
  });

  it("floors below one", () => {
    expect(clampPage(0, 100, 25)).toBe(1);
    expect(clampPage(-5, 100, 25)).toBe(1);
  });

  it("tolerates a non-finite page", () => {
    expect(clampPage(Number.NaN, 100, 25)).toBe(1);
  });
});

describe("pageSlice", () => {
  const rows = Array.from({ length: 57 }, (_, index) => index);

  it("returns the first page", () => {
    expect(pageSlice(rows, 1, 25)).toEqual(rows.slice(0, 25));
  });

  it("returns a middle page", () => {
    expect(pageSlice(rows, 2, 25)).toEqual(rows.slice(25, 50));
  });

  it("returns the short final page", () => {
    expect(pageSlice(rows, 3, 25)).toHaveLength(7);
  });

  it("clamps an out-of-range page instead of returning nothing", () => {
    expect(pageSlice(rows, 99, 25)).toHaveLength(7);
  });

  it("handles an empty set", () => {
    expect(pageSlice([], 1, 25)).toEqual([]);
  });

  it("loses no row across all pages", () => {
    const seen = [1, 2, 3].flatMap((page) => pageSlice(rows, page, 25));
    expect(seen).toEqual(rows);
  });
});

describe("pageBounds", () => {
  it("reports inclusive 1-indexed bounds", () => {
    expect(pageBounds(2, 25, 57)).toEqual({ first: 26, last: 50 });
  });

  it("stops the last page at the row count", () => {
    expect(pageBounds(3, 25, 57)).toEqual({ first: 51, last: 57 });
  });

  it("reports nulls when there is nothing", () => {
    expect(pageBounds(1, 25, 0)).toEqual({ first: null, last: null });
  });
});

describe("rangeLabel", () => {
  it("never claims a total of what exists, only of what is loaded", () => {
    const label = rangeLabel(1, 25, 137);
    expect(label).toBe("Showing 1–25 of 137 loaded");
    // "of 137" without "loaded" would read as a complete count.
    expect(label).toContain("loaded");
  });

  it("omits the range when everything fits on one page", () => {
    expect(rangeLabel(1, 25, 9)).toBe("9 rows loaded");
  });

  it("marks a filtered set", () => {
    expect(rangeLabel(1, 25, 9, { filtered: true })).toBe("9 rows loaded (filtered)");
  });

  it("marks truncation so the count is not read as complete", () => {
    expect(rangeLabel(1, 25, 500, { truncated: true })).toContain("500+");
  });

  it("uses the singular for one row", () => {
    expect(rangeLabel(1, 25, 1)).toBe("1 row loaded");
  });

  it("says so when empty", () => {
    expect(rangeLabel(1, 25, 0)).toBe("No rows loaded");
    expect(rangeLabel(1, 25, 0, { filtered: true })).toBe("No rows match this filter");
  });
});

describe("isTruncated", () => {
  it("is true when the loaded window reached the request limit", () => {
    expect(isTruncated(500, 500)).toBe(true);
  });

  it("is false for a partial window", () => {
    expect(isTruncated(499, 500)).toBe(false);
    expect(isTruncated(0, 500)).toBe(false);
  });
});

describe("page size options", () => {
  it("offers ascending sizes starting at the default", () => {
    expect(PAGE_SIZES[0]).toBe(DEFAULT_PAGE_SIZE);
    expect([...PAGE_SIZES]).toEqual([...PAGE_SIZES].sort((a, b) => a - b));
  });

  it("never exceeds the contract's 500-row list maximum", () => {
    for (const size of PAGE_SIZES) expect(size).toBeLessThanOrEqual(500);
  });
});
