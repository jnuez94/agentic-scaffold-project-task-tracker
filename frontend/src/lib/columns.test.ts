import { describe, expect, it } from "vitest";
import { withoutVacantColumns } from "./columns.ts";

interface Row {
  id: string;
  next: string | null;
  tags: string;
}

const row = (overrides: Partial<Row> = {}): Row => ({
  id: "T-1",
  next: "Claim",
  tags: "frontend",
  ...overrides,
});

const columns = [
  { key: "id" },
  { key: "next", vacantFor: (r: Row) => r.next === null },
  { key: "tags", vacantFor: (r: Row) => r.tags === "" },
];

const keys = (result: { key: string }[]) => result.map((column) => column.key);

describe("withoutVacantColumns", () => {
  it("keeps a column that is filled on every row", () => {
    expect(keys(withoutVacantColumns(columns, [row(), row()]))).toEqual(["id", "next", "tags"]);
  });

  it("drops a column that is vacant on every row", () => {
    const rows = [row({ next: null }), row({ next: null })];
    expect(keys(withoutVacantColumns(columns, rows))).toEqual(["id", "tags"]);
  });

  it("keeps a column that is filled on even one row", () => {
    // The contrast between the filled cell and the empty ones is the
    // information; this is the case that must not be over-collapsed.
    const rows = [row({ next: null }), row({ next: "Claim" }), row({ next: null })];
    expect(keys(withoutVacantColumns(columns, rows))).toEqual(["id", "next", "tags"]);
  });

  it("drops several vacant columns at once", () => {
    const rows = [row({ next: null, tags: "" })];
    expect(keys(withoutVacantColumns(columns, rows))).toEqual(["id"]);
  });

  it("never drops a column that has not opted in", () => {
    // `id` has no predicate, so it survives even when every value is empty.
    const rows = [row({ id: "" }), row({ id: "" })];
    expect(keys(withoutVacantColumns(columns, rows))).toContain("id");
  });

  it("keeps every column when nothing is loaded", () => {
    // No rows is no evidence. Dropping here would make an empty table disagree
    // with a populated one for no reason the operator could see.
    expect(keys(withoutVacantColumns(columns, []))).toEqual(["id", "next", "tags"]);
  });

  it("does not mutate the columns it was given", () => {
    const original = [...columns];
    withoutVacantColumns(columns, [row({ next: null })]);
    expect(columns).toEqual(original);
  });

  it("returns a new array even when nothing is dropped", () => {
    const result = withoutVacantColumns(columns, [row()]);
    expect(result).not.toBe(columns);
  });
});
