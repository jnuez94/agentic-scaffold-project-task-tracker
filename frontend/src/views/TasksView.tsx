/**
 * The task queue — the console's hero surface.
 */

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Agent, TaskListRow } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { TASK_STATUSES } from "../api/contract.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { ResizeHandle } from "../components/ResizeHandle.tsx";
import { filterRows } from "../lib/filters.ts";
import { agentOptionLabel } from "../lib/labels.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { BOUNDS } from "../state/layoutStore.ts";
import type { Layout } from "../state/useLayout.ts";
import { useResource } from "../state/useResource.ts";
import { TaskInspector } from "./TaskInspector.tsx";
import { TASK_DEFAULT_ORDER, taskColumns } from "./taskColumns.tsx";
import { withAssignColumn } from "./taskAssignColumn.tsx";
import { AssigneeEditor } from "./AssigneeEditor.tsx";

const REQUEST_LIMIT = 500;

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
  const { coordination, identity, session } = useApp();
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");

  const tasks = useResource(
    () => coordination.tasks({
        status: status || undefined,
        assignee: assignee || undefined,
        limit: REQUEST_LIMIT,
      }),
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

  // Assignment from the row, opening the same editor the inspector opens.
  const [assigning, setAssigning] = useState<TaskListRow | null>(null);
  const assignTrigger = useRef<HTMLButtonElement | null>(null);

  const columns = useMemo(
    // Resolved session, so the Next action column cannot offer Claim on the
    // strength of a session that has ended.
    () =>
      withAssignColumn(
        taskColumns(nameFor, {
          actorId: identity.actorId,
          sessionId: session.activeSessionId,
        }),
        (row, trigger) => {
          assignTrigger.current = trigger;
          setAssigning(row);
        },
      ),
    [nameFor, identity.actorId, session.activeSessionId],
  );

  return (
    <div
      className={selectedId ? "queue-layout with-inspector" : "queue-layout"}
      style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}
    >
      <section className="queue" aria-label="Task queue">
        {/* Tasks is where the console opens, and it was the only one of the
            eleven routes with no visible heading: the h1 was here but clipped
            to 1x1, so screen readers were told where "here" is and everyone
            else landed on an untitled table. Now it uses the same .view-header
            every other route uses. The description states the ordering, which
            was previously only reachable as the table's accessible caption —
            sighted operators should not have to infer why UI-1 sorts above
            UX-12. */}
        <div className="view-header">
          <h1>Tasks</h1>
          <p className="small muted">
            Work items and their current state. Ordered by priority, then most
            recently updated.
          </p>
        </div>

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
              {/* Name alone is not an identity. Two distinct agent records
                  share the display name "Toby" — one active, one retired — and
                  rendering just the name gave the operator two identical
                  options with no way to tell which one owns SEC-1. Retired
                  agents stay selectable here: this is a lens over existing
                  records, and historical assignments to retired identities
                  must remain filterable. Only "Acting as" gates on status. */}
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agentOptionLabel(agent)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tasks.error ? <ErrorBanner error={tasks.error} onRetry={tasks.refresh} /> : null}

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(task) => task.id}
          caption="Coordination tasks"
          defaultOrder={TASK_DEFAULT_ORDER}
          idPrefix="tasks"
          filtered={Boolean(filter)}
          truncated={isTruncated((tasks.data ?? []).length, REQUEST_LIMIT)}
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

        {/* Anchored to the queue rather than the inspector: the operator acted
            from a row and the row stays on screen behind it. Same component the
            inspector uses, so the retired-agent grouping, the Name and id
            labelling and the single add-and-remove call cannot drift apart. */}
        {assigning ? (
          <div className="row-assign-anchor">
            <AssigneeEditor
              task={assigning}
              agents={agents}
              onClose={() => {
                setAssigning(null);
                assignTrigger.current?.focus();
              }}
              onSaved={() => {
                tasks.refresh();
                setAssigning(null);
              }}
            />
          </div>
        ) : null}
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
