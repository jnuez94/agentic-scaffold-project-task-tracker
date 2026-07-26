import { describe, expect, it } from "vitest";
import {
  ariaSortFor,
  compareValues,
  nextSortState,
  sortRows,
  type SortState,
} from "./sorting.ts";

describe("compareValues", () => {
  it("orders numbers numerically", () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(10, 9)).toBeGreaterThan(0);
    expect(compareValues(3, 3)).toBe(0);
  });

  it("orders strings case-insensitively", () => {
    expect(compareValues("apple", "Banana")).toBeLessThan(0);
    expect(compareValues("Zebra", "apple")).toBeGreaterThan(0);
  });

  it("orders embedded numbers naturally", () => {
    // Lexical ordering would put UI-10 before UI-2.
    expect(compareValues("UI-2", "UI-10")).toBeLessThan(0);
  });

  it("sorts empty values last regardless of the other operand", () => {
    expect(compareValues(null, "a")).toBeGreaterThan(0);
    expect(compareValues("a", null)).toBeLessThan(0);
    expect(compareValues(undefined, 5)).toBeGreaterThan(0);
    expect(compareValues("", "a")).toBeGreaterThan(0);
  });

  it("treats two empties as equal", () => {
    expect(compareValues(null, undefined)).toBe(0);
    expect(compareValues("", null)).toBe(0);
  });

  it("does not treat zero as empty", () => {
    expect(compareValues(0, 5)).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  const rows = [
    { id: "c", n: 2 },
    { id: "a", n: 3 },
    { id: "b", n: 1 },
  ];

  it("sorts ascending", () => {
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts descending", () => {
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input", () => {
    const original = [...rows];
    sortRows(rows, (r) => r.n, "desc");
    expect(rows).toEqual(original);
  });

  it("is stable for equal keys", () => {
    const tied = [
      { id: "first", n: 1 },
      { id: "second", n: 1 },
      { id: "third", n: 1 },
    ];
    expect(sortRows(tied, (r) => r.n, "asc").map((r) => r.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("keeps empty values last when ascending", () => {
    const mixed = [{ v: "b" }, { v: null }, { v: "a" }];
    expect(sortRows(mixed, (r) => r.v, "asc").map((r) => r.v)).toEqual(["a", "b", null]);
  });

  it("keeps empty values last when descending too", () => {
    const mixed = [{ v: "b" }, { v: null }, { v: "a" }];
    expect(sortRows(mixed, (r) => r.v, "desc").map((r) => r.v)).toEqual(["b", "a", null]);
  });

  it("handles an empty list", () => {
    expect(sortRows([], (r: { v: string }) => r.v, "asc")).toEqual([]);
  });
});

describe("nextSortState", () => {
  it("starts a new column ascending", () => {
    expect(nextSortState(null, "id")).toEqual({ key: "id", direction: "asc" });
  });

  it("switches to descending on the second click", () => {
    const asc: SortState = { key: "id", direction: "asc" };
    expect(nextSortState(asc, "id")).toEqual({ key: "id", direction: "desc" });
  });

  it("clears on the third click, restoring the CLI default order", () => {
    const desc: SortState = { key: "id", direction: "desc" };
    expect(nextSortState(desc, "id")).toBeNull();
  });

  it("restarts ascending when a different column is clicked", () => {
    const desc: SortState = { key: "id", direction: "desc" };
    expect(nextSortState(desc, "state")).toEqual({ key: "state", direction: "asc" });
  });
});

describe("ariaSortFor", () => {
  it("reports none when unsorted or sorted by another column", () => {
    expect(ariaSortFor(null, "id")).toBe("none");
    expect(ariaSortFor({ key: "other", direction: "asc" }, "id")).toBe("none");
  });

  it("reports the active direction", () => {
    expect(ariaSortFor({ key: "id", direction: "asc" }, "id")).toBe("ascending");
    expect(ariaSortFor({ key: "id", direction: "desc" }, "id")).toBe("descending");
  });
});
