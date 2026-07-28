/**
 * The assignment action on a task row (UI-36).
 *
 * Mirrors recordActionColumn: the row itself opens the inspector, so the action
 * stops propagation and does its own thing. Extracted from TasksView for the
 * same reason that one was extracted from RecordsView — the view stays a view.
 *
 * The predicate is the interesting part. Assignment's one refusal is that the
 * active claim owner cannot be removed, and that is the most likely reason an
 * operator opens this panel from a claimed row. A row has no space for
 * "david holds the active claim; release or recover it first", and a reason
 * truncated to fit is worse than no control at all — so a claimed task shows a
 * dash here and keeps its full explanation in the inspector, where there is
 * room to say it properly.
 */

import type { TaskListRow } from "../api/contract.ts";
import type { Column } from "../components/DataTable.tsx";

/** Whether the row-level assignment action is offered for this task. */
export function assignmentApplies(row: Pick<TaskListRow, "claimed_by">): boolean {
  return !row.claimed_by;
}

export function withAssignColumn(
  columns: Column<TaskListRow>[],
  onAssign: (row: TaskListRow, trigger: HTMLButtonElement) => void,
): Column<TaskListRow>[] {
  return [
    ...columns,
    {
      key: "__assign",
      // Not "Assignees": the table already has an "Assignees / Claim" column
      // showing who holds the task, and two columns with the same name is a
      // header that describes neither. This one names the act, not the field.
      header: "Reassign",
      // Lowest priority: this is the first column the container query drops,
      // because the inspector still offers the same action at any width.
      priority: 9,
      render: (row: TaskListRow) =>
        assignmentApplies(row) ? (
          <button
            type="button"
            className="link-button"
            onClick={(event) => {
              // Selecting the row opens the inspector; this is not that.
              event.stopPropagation();
              onAssign(row, event.currentTarget);
            }}
          >
            Assign…
          </button>
        ) : (
          <span className="small muted" title="Claimed tasks can be reassigned from the inspector">
            —
          </span>
        ),
    },
  ];
}
