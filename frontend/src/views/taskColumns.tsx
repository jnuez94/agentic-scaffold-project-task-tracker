/**
 * Column definitions for the task queue.
 *
 * `sortValue` is what makes a column sortable. Two of them are deliberately
 * not the rendered text: State ranks by lifecycle position rather than
 * alphabet, and Assignees/Claim sorts by the claim owner when there is one,
 * because that is the person a reader is actually looking for.
 */

import type { Column } from "../components/DataTable.tsx";
import { IdCell } from "../components/Fields.tsx";
import { Owners } from "../components/Owners.tsx";
import { PriorityTag, StatusPill, TagText } from "../components/Pill.tsx";
import type { TaskListRow } from "../api/contract.ts";
import { relativeTime } from "../lib/format.ts";
import { splitTags, statusRank } from "../lib/labels.ts";
import { availableActions, type ActionContext } from "../lib/transitions.ts";

export const TASK_DEFAULT_ORDER = "the CLI order: priority, then updated, then id";

/** The action an operator would most likely take next, or null if none is offered. */
export function nextActionLabel(task: TaskListRow, context: ActionContext): string | null {
  const actions = availableActions(task, context);
  const usable = actions.filter((action) => !action.blockedReason);
  const primary = usable.find((action) => action.primary) ?? usable[0];
  return primary?.label ?? null;
}

export function taskColumns(
  nameFor: (id: string) => string,
  context: ActionContext,
): Column<TaskListRow>[] {
  return [
    {
      key: "id",
      header: "ID / Title",
      priority: 1,
      render: (task) => <IdCell id={task.id} title={task.title} />,
      sortValue: (task) => task.id,
    },
    {
      key: "state",
      header: "State",
      priority: 2,
      render: (task) => <StatusPill status={task.status} />,
      sortValue: (task) => statusRank(task.status),
    },
    {
      key: "priority",
      header: "Priority",
      priority: 7,
      render: (task) => <PriorityTag priority={task.priority} />,
      sortValue: (task) => task.priority,
    },
    {
      key: "owner",
      header: "Assignees / Claim",
      priority: 3,
      render: (task) => <Owners task={task} nameFor={nameFor} />,
      sortValue: (task) => task.claimed_by ?? task.assignees[0] ?? null,
    },
    {
      key: "rev",
      header: "Rev",
      priority: 5,
      align: "end",
      render: (task) => <span className="mono">{task.revision}</span>,
      sortValue: (task) => task.revision,
    },
    {
      key: "evidence",
      header: "Evidence",
      priority: 6,
      align: "end",
      render: (task) => (
        <span className={task.evidence_count === 0 ? "mono muted" : "mono"}>
          {task.evidence_count}
        </span>
      ),
      sortValue: (task) => task.evidence_count,
    },
    {
      key: "updated",
      header: "Updated",
      priority: 8,
      render: (task) => (
        <span title={task.updated_at} className="small">
          {relativeTime(task.updated_at)}
        </span>
      ),
      sortValue: (task) => task.updated_at,
    },
    {
      key: "next",
      header: "Next action",
      priority: 4,
      render: (task) => {
        const label = nextActionLabel(task, context);
        return label ? (
          <span className="next-action">{label}</span>
        ) : (
          <span className="muted small">—</span>
        );
      },
      sortValue: (task) => nextActionLabel(task, context),
      // A done task has no valid transition, and a mature board is mostly
      // done — so this column reserves width to render a column of dashes
      // exactly as the project it describes matures (UI-44). It stays as soon
      // as one row has an action to offer.
      vacantFor: (task) => nextActionLabel(task, context) === null,
    },
    {
      key: "tags",
      header: "Tags",
      priority: 9,
      // Capped, because quieting the pills alone made this column *wider*:
      // measured 177px before and 218px after, since five small boxes wrap
      // more compactly than one long string and auto table layout hands the
      // string the room it asks for. UI-44 is a width complaint, so the width
      // has to be answered directly — the text wraps inside this instead.
      width: "140px",
      // Text, not pills. The board carries 117 distinct tags across 80 tasks
      // and 72 are used exactly once, so pills were paying the visual mass of
      // a grouping affordance for what is closer to freeform annotation — and
      // outshouting the title beside them. Full pills remain in the inspector,
      // and the loaded-row filter still matches this text (UI-44).
      render: (task) => <TagText tags={splitTags(task.tags)} />,
      sortValue: (task) => splitTags(task.tags)[0] ?? null,
      vacantFor: (task) => splitTags(task.tags).length === 0,
    },
  ];
}
