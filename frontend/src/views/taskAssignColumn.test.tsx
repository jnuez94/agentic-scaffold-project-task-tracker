/**
 * The assignment action on a task row (UI-36).
 *
 * The predicate carries the design decision, so it is tested on its own: a
 * claimed task shows no control, because assignment's one refusal is that the
 * claim owner cannot be removed and a row has no space to say why.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { assignmentApplies, withAssignColumn } from "./taskAssignColumn.tsx";

function row(overrides: Partial<TaskListRow> = {}): TaskListRow {
  return {
    id: "UI-1",
    title: "A task",
    status: "todo",
    priority: 1,
    assignees: ["david"],
    claimed_by: null,
    claim_session_id: null,
    revision: 4,
    evidence_count: 0,
    updated_at: "2026-07-28T10:00:00+00:00",
    tags: "",
    ...overrides,
  } as TaskListRow;
}

describe("assignmentApplies", () => {
  it("offers the action on an unclaimed task", () => {
    expect(assignmentApplies(row())).toBe(true);
  });

  it("withholds it on a claimed task", () => {
    // Not because assignment is impossible, but because the likely intent —
    // removing the holder — is refused, and the row cannot explain that.
    expect(assignmentApplies(row({ claimed_by: "david" }))).toBe(false);
  });
});

function renderTable(rows: TaskListRow[], onAssign = vi.fn()) {
  render(
    <DataTable
      rows={rows}
      columns={withAssignColumn([], onAssign)}
      rowKey={(t) => t.id}
      caption="Tasks"
      defaultOrder="test"
      idPrefix="t"
      loaded
      onSelect={vi.fn()}
      emptyTitle="none"
      emptyHint="none"
    />,
  );
  return { onAssign };
}

describe("withAssignColumn", () => {
  it("renders an action for an unclaimed row", () => {
    renderTable([row()]);
    expect(screen.getByRole("button", { name: "Assign…" })).toBeTruthy();
  });

  it("renders a dash for a claimed row rather than a control that would fail", () => {
    renderTable([row({ id: "UI-2", claimed_by: "david" })]);
    expect(screen.queryByRole("button", { name: "Assign…" })).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("hands back the row and its trigger", async () => {
    const user = userEvent.setup();
    const { onAssign } = renderTable([row()]);
    await user.click(screen.getByRole("button", { name: "Assign…" }));
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign.mock.calls[0]?.[0]).toMatchObject({ id: "UI-1" });
    // The trigger is passed so focus can return to it on close.
    expect(onAssign.mock.calls[0]?.[1]).toBeInstanceOf(HTMLButtonElement);
  });

  it("does not select the row when the action is used", async () => {
    // The row opens the inspector; the action is a different intent, so it
    // stops propagation.
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onAssign = vi.fn();
    render(
      <DataTable
        rows={[row()]}
        columns={withAssignColumn([], onAssign)}
        rowKey={(t) => t.id}
        caption="Tasks"
        defaultOrder="test"
        idPrefix="t"
        loaded
        onSelect={onSelect}
        emptyTitle="none"
        emptyHint="none"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Assign…" }));
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("appends rather than replacing the columns it is given", () => {
    const existing = [
      { key: "id", header: "ID", priority: 1, render: (t: TaskListRow) => t.id },
    ];
    const result = withAssignColumn(existing, vi.fn());
    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe("id");
    expect(result[1]?.key).toBe("__assign");
  });

  it("does not reuse the name of the existing assignees column", () => {
    // "Assignees / Claim" already shows who holds the task; a second column
    // with the same name describes neither.
    const result = withAssignColumn([], vi.fn());
    expect(result[0]?.header).toBe("Reassign");
  });

  it("is the first column dropped when space is tight", () => {
    // The inspector offers the same action at any width, so this one yields.
    const result = withAssignColumn([], vi.fn());
    expect(result[0]?.priority).toBe(9);
  });
});
