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
import { PriorityTag, StatusPill, TagList } from "../components/Pill.tsx";
import type { TaskListRow } from "../api/contract.ts";
import { relativeTime } from "../lib/format.ts";
import { splitTags, statusRank } from "../lib/labels.ts";

export const TASK_DEFAULT_ORDER = "the CLI order: priority, then updated, then id";

export function taskColumns(nameFor: (id: string) => string): Column<TaskListRow>[] {
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
      key: "tags",
      header: "Tags",
      priority: 9,
      render: (task) => <TagList tags={splitTags(task.tags)} />,
      sortValue: (task) => splitTags(task.tags)[0] ?? null,
    },
  ];
}
