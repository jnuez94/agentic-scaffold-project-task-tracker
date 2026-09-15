/**
 * The audit log's columns, rendered through a real DataTable, because the
 * claims are about what an operator sees rather than the shape of an array.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { humanize } from "../lib/labels.ts";
import { AUDIT_COLUMNS, AUDIT_DEFAULT_ORDER } from "./auditColumns.tsx";

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 1,
  actor: "alice",
  session_id: "s-1",
  action: "status_change",
  object_type: "task",
  object_id: "T-1",
  detail: "",
  created_at: "2026-09-15T10:00:00+00:00",
  ...overrides,
});

function renderLog(rows: AuditEntry[]) {
  render(
    <DataTable
      rows={rows}
      columns={AUDIT_COLUMNS}
      rowKey={(row) => String(row.id)}
      caption="Audit log"
      defaultOrder={AUDIT_DEFAULT_ORDER}
      idPrefix="audit"
    />,
  );
}

// Sortable headers carry a sort glyph, so match by name rather than equality.
const headers = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent ?? "");
const hasHeader = (name: string) => headers().some((text) => text.includes(name));

describe("audit log columns", () => {
  it("leads with when, then what, then to which object", () => {
    renderLog([entry()]);
    const [first, second, third] = headers();
    expect(first).toContain("When");
    expect(second).toContain("Action");
    expect(third).toContain("Object");
  });

  it("renders the action humanised and the identifiers in monospace", () => {
    renderLog([entry()]);
    expect(screen.getByText(humanize("status_change"))).toBeTruthy();
    expect(screen.getByText("T-1").className).toContain("mono");
    expect(screen.getByText("alice").className).toContain("mono");
  });

  it("drops the detail and session columns when no loaded row has them", () => {
    renderLog([entry({ detail: "", session_id: null })]);
    expect(hasHeader("Detail")).toBe(false);
    expect(hasHeader("Session")).toBe(false);
  });

  it("shows a dash for a row without a session once the column is present", () => {
    renderLog([entry({ id: 2, session_id: "s-2" }), entry({ id: 1, session_id: null })]);
    expect(hasHeader("Session")).toBe(true);
    expect(screen.getByText("s-2")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("names the default order so the caption can state it", () => {
    renderLog([entry()]);
    expect(screen.getByText(/in newest first/)).toBeTruthy();
  });
});
