/**
 * The task queue's columns, as rendered through a real DataTable.
 *
 * Driven through the table rather than by inspecting the column array, because
 * the claims being made are about what an operator sees: which headers exist,
 * how much weight the tags carry, and whether a column of em-dashes is holding
 * width. Asserting on the array would pass while the table rendered anything.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { TASK_DEFAULT_ORDER, taskColumns } from "./taskColumns.tsx";

const task = (overrides: Partial<TaskListRow> = {}): TaskListRow => ({
  id: "UI-1",
  title: "A task",
  description: "",
  status: "todo",
  priority: 2,
  tags: "frontend,api",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "",
  notes: "",
  revision: 1,
  created_by: "david",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  claimed_by: null,
  claim_session_id: null,
  claimed_at: null,
  assignees: ["david"],
  evidence_count: 0,
  ...overrides,
});

const CONTEXT = { actorId: "david", sessionId: "console-1" };

function renderQueue(rows: TaskListRow[], context = CONTEXT) {
  render(
    <DataTable
      rows={rows}
      columns={taskColumns((id) => id, context)}
      rowKey={(row) => row.id}
      caption="Coordination tasks"
      defaultOrder={TASK_DEFAULT_ORDER}
      idPrefix="tasks"
    />,
  );
}

const headers = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent ?? "");

describe("task queue columns", () => {
  it("leads with the column an operator reads to identify a task", () => {
    renderQueue([task()]);
    expect(headers()[0]).toContain("ID / Title");
  });

  it("does not offer reassignment from the row (UI-41)", () => {
    // UX-ROW-ACTION-1: the editor has one home, and it is the inspector.
    renderQueue([task()]);
    expect(headers().join(" ")).not.toContain("Reassign");
    // "Assign…" was the row control's label. The "Assignees / Claim" sort
    // header is a different thing and must survive, so match exactly.
    expect(screen.queryByRole("button", { name: "Assign…" })).toBeNull();
  });

  it("keeps the Assignees / Claim column, which UI-41 does not touch", () => {
    renderQueue([task()]);
    expect(headers().join(" ")).toContain("Assignees / Claim");
  });

  it("shows Updated as relative time even years back (UI-46)", () => {
    renderQueue([task({ updated_at: "2020-01-01T00:00:00Z" })]);
    // Purely relative, with no locale date anywhere in it — the seven-day
    // cutoff that rendered "Jan 1, 2020" here is gone.
    expect(screen.getByText(/d ago$/).textContent).toMatch(/^\d+d ago$/);
  });

  it("keeps the exact stored timestamp reachable on the cell", () => {
    renderQueue([task({ updated_at: "2026-08-01T00:00:00Z" })]);
    expect(screen.getByTitle("2026-08-01T00:00:00Z")).toBeTruthy();
  });
});
