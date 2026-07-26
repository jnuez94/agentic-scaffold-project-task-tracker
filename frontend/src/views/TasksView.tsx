/**
 * The task queue — the console's hero surface.
 */

import { useMemo, useState } from "react";
import type { Agent, TaskListRow } from "../api/contract.ts";
import { TASK_STATUSES } from "../api/contract.ts";
import { DataTable, type Column } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { IdCell } from "../components/Fields.tsx";
import { PriorityTag, StatusPill, TagList } from "../components/Pill.tsx";
import { relativeTime } from "../lib/format.ts";
import { filterRows } from "../lib/filters.ts";
import { initials, splitTags } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { TaskInspector } from "./TaskInspector.tsx";

const FILTER_FIELDS = ["id", "title", "description", "tags", "assignees", "claimed_by"];

export function TasksView({
  filter,
  agents,
  selectedId,
  onSelect,
}: {
  filter: string;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { coordination } = useApp();
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");

  const tasks = useResource(
    () => coordination.tasks({ status: status || undefined, assignee: assignee || undefined, limit: 500 }),
    [status, assignee],
  );

  const rows = useMemo(
    () => filterRows(tasks.data ?? [], FILTER_FIELDS, filter),
    [tasks.data, filter],
  );

  const nameFor = useMemo(() => {
    const byId = new Map(agents.map((agent) => [agent.id, agent.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [agents]);

  const columns: Column<TaskListRow>[] = [
    {
      key: "id",
      header: "ID / Title",
      priority: 1,
      render: (task) => <IdCell id={task.id} title={task.title} />,
    },
    { key: "state", header: "State", priority: 2, render: (task) => <StatusPill status={task.status} /> },
    {
      key: "priority",
      header: "Priority",
      priority: 7,
      render: (task) => <PriorityTag priority={task.priority} />,
    },
    {
      key: "owner",
      header: "Assignees / Claim",
      priority: 3,
      render: (task) => <Owners task={task} nameFor={nameFor} />,
    },
    {
      key: "rev",
      header: "Rev",
      priority: 5,
      align: "end",
      render: (task) => <span className="mono">{task.revision}</span>,
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
    },
    {
      key: "tags",
      header: "Tags",
      priority: 9,
      render: (task) => <TagList tags={splitTags(task.tags)} />,
    },
  ];

  return (
    <div className={selectedId ? "queue-layout with-inspector" : "queue-layout"}>
      <section className="queue" aria-label="Task queue">
        <div className="queue-toolbar">
          <div className="control">
            <label htmlFor="status-filter">State</label>
            <select
              id="status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All states</option>
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="control">
            <label htmlFor="assignee-filter">Assignee</label>
            <select
              id="assignee-filter"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="">Anyone</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
          <p className="queue-count small muted" aria-live="polite">
            {/* No total is claimed: list results carry no count in the contract. */}
            {rows.length} {rows.length === 1 ? "task" : "tasks"} loaded
            {filter ? " (filtered)" : ""}
          </p>
        </div>

        {tasks.error ? <ErrorBanner error={tasks.error} onRetry={tasks.refresh} /> : null}

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(task) => task.id}
          caption="Coordination tasks"
          loading={tasks.loading}
          loaded={tasks.loaded}
          selectedKey={selectedId}
          onSelect={(task) => onSelect(task.id)}
          emptyTitle={filter || status || assignee ? "No tasks match these filters" : "No tasks yet"}
          emptyHint={
            filter || status || assignee
              ? "Clear the filters to see the full queue."
              : "Create one with the coordination CLI, then refresh."
          }
        />
      </section>

      {selectedId ? (
        <TaskInspector
          taskId={selectedId}
          agents={agents}
          onClose={() => onSelect(null)}
          onChanged={tasks.refresh}
        />
      ) : null}
    </div>
  );
}

function Owners({ task, nameFor }: { task: TaskListRow; nameFor: (id: string) => string }) {
  if (task.assignees.length === 0 && !task.claimed_by) {
    return <span className="muted small">Unassigned</span>;
  }
  return (
    <div className="owners">
      {task.assignees.map((id) => (
        <span className="owner" key={id} title={`Assignee: ${id}`}>
          <span className="avatar" aria-hidden="true">
            {initials(nameFor(id))}
          </span>
          <span className="small">{nameFor(id)}</span>
        </span>
      ))}
      {task.claimed_by ? (
        <span className="claim-badge" title={`Claim session: ${task.claim_session_id ?? "unknown"}`}>
          Claimed by {nameFor(task.claimed_by)}
        </span>
      ) : null}
    </div>
  );
}
