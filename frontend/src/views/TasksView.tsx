/**
 * The task queue — the console's hero surface.
 */

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Agent } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { TASK_STATUSES } from "../api/contract.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { ResizeHandle } from "../components/ResizeHandle.tsx";
import { filterRows } from "../lib/filters.ts";
import { useApp } from "../state/AppContext.tsx";
import { BOUNDS } from "../state/layoutStore.ts";
import type { Layout } from "../state/useLayout.ts";
import { useResource } from "../state/useResource.ts";
import { TaskInspector } from "./TaskInspector.tsx";
import { TASK_DEFAULT_ORDER, taskColumns } from "./taskColumns.tsx";

const FILTER_FIELDS = ["id", "title", "description", "tags", "assignees", "claimed_by"];

export function TasksView({
  filter,
  agents,
  selectedId,
  onSelect,
  layout,
}: {
  filter: string;
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  layout: Layout;
}) {
  const inspectorWidth = layout.widths.inspector;
  const { coordination, identity } = useApp();
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

  const columns = useMemo(
    () => taskColumns(nameFor, { actorId: identity.actorId, sessionId: identity.sessionId }),
    [nameFor, identity.actorId, identity.sessionId],
  );

  return (
    <div
      className={selectedId ? "queue-layout with-inspector" : "queue-layout"}
      style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}
    >
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
          defaultOrder={TASK_DEFAULT_ORDER}
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
        <>
          {/* Only painted in the overlay regimes; CSS hides it elsewhere. */}
          <div className="inspector-scrim" onClick={() => onSelect(null)} aria-hidden="true" />
          <ResizeHandle
            label="Resize task inspector"
            value={inspectorWidth}
            min={BOUNDS.inspector.min}
            max={BOUNDS.inspector.max}
            direction={-1}
            onResize={(next) => layout.setWidth("inspector", next)}
            onReset={() => layout.reset("inspector")}
          />
          <TaskInspector
            taskId={selectedId}
            agents={agents}
            onClose={() => onSelect(null)}
            onChanged={tasks.refresh}
          />
        </>
      ) : null}
    </div>
  );
}
