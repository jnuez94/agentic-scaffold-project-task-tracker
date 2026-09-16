import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { filterRows } from "./filters.ts";
import { AUDIT_FILTER_FIELDS, auditRangeLabel, facetValues, narrowAudit } from "./auditWindow.ts";

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 1,
  actor: "alice",
  session_id: "s-1",
  action: "create",
  object_type: "task",
  object_id: "T-1",
  detail: "",
  created_at: "2026-09-15T10:00:00+00:00",
  ...overrides,
});

const ROWS = [
  entry({ id: 3, action: "claim", object_type: "task", object_id: "T-2" }),
  entry({ id: 2, action: "create", object_type: "agent", object_id: "bob", session_id: null }),
  entry({ id: 1, action: "create", object_type: "task", object_id: "T-1", detail: "seeded" }),
];

describe("facetValues", () => {
  it("lists each value once, sorted, from the loaded rows only", () => {
    expect(facetValues(ROWS, "object_type")).toEqual(["agent", "task"]);
    expect(facetValues(ROWS, "action")).toEqual(["claim", "create"]);
  });

  it("drops empty values rather than offering a blank option", () => {
    expect(facetValues([entry({ actor: "" }), entry({ actor: "bob" })], "actor")).toEqual(["bob"]);
  });
});

describe("narrowAudit", () => {
  it("returns the same array when nothing is selected", () => {
    expect(narrowAudit(ROWS, { objectType: "", action: "" })).toBe(ROWS);
  });

  it("narrows by object type, by action, and by both together", () => {
    const ids = (rows: AuditEntry[]) => rows.map((row) => row.id);
    expect(ids(narrowAudit(ROWS, { objectType: "task", action: "" }))).toEqual([3, 1]);
    expect(ids(narrowAudit(ROWS, { objectType: "", action: "create" }))).toEqual([2, 1]);
    expect(ids(narrowAudit(ROWS, { objectType: "task", action: "create" }))).toEqual([1]);
  });
});

describe("auditRangeLabel", () => {
  const full = { window: 500, narrowed: false };
  const narrowed = { window: 500, narrowed: true };

  it("states the window rather than hedging about it", () => {
    expect(auditRangeLabel(1, 10, 500, full)).toBe("Showing 1–10 of the newest 500");
    expect(auditRangeLabel(1, 50, 37, { window: 37, narrowed: false })).toBe("The newest 37");
  });

  it("names the narrowing within the window", () => {
    expect(auditRangeLabel(2, 10, 37, narrowed)).toBe(
      "Showing 11–20 of 37 matching, within the newest 500",
    );
    expect(auditRangeLabel(1, 50, 37, narrowed)).toBe("37 matching, within the newest 500");
  });

  it("separates thousands once the window has grown that far", () => {
    expect(auditRangeLabel(1, 10, 1000, { window: 1000, narrowed: false })).toBe(
      "Showing 1–10 of the newest 1,000",
    );
    expect(auditRangeLabel(1, 10, 12, { window: 1500, narrowed: true })).toBe(
      "Showing 1–10 of 12 matching, within the newest 1,500",
    );
  });

  it("never carries the shared hedges", () => {
    for (const label of [
      auditRangeLabel(1, 10, 500, full),
      auditRangeLabel(3, 10, 37, narrowed),
      auditRangeLabel(1, 10, 0, full),
      auditRangeLabel(1, 10, 0, narrowed),
    ]) {
      expect(label).not.toContain("+");
      expect(label).not.toMatch(/may exist/);
    }
  });
});

describe("AUDIT_FILTER_FIELDS", () => {
  it("lets the filter box reach detail and session id, not just identifiers", () => {
    expect(filterRows(ROWS, AUDIT_FILTER_FIELDS, "seeded").map((row) => row.id)).toEqual([1]);
    expect(filterRows(ROWS, AUDIT_FILTER_FIELDS, "s-1").map((row) => row.id)).toEqual([3, 1]);
  });
});
