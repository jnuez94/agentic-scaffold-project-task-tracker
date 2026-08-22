/**
 * The task queue — the console's hero surface.
 */

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Agent } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { ResizeHandle } from "../components/ResizeHandle.tsx";
import { attentionReason, needsAttention, type AttentionReason } from "../lib/attention.ts";
import { attentionTotal, summariseAttention } from "../lib/attentionSummary.ts";
import { filterRows } from "../lib/filters.ts";
import { isTruncated } from "../lib/pagination.ts";
import { queueEmptyState } from "../lib/queueEmpty.ts";
import { isRecoverable } from "../lib/staleness.ts";
import { useApp } from "../state/AppContext.tsx";
import { BOUNDS } from "../state/layoutStore.ts";
import type { Layout } from "../state/useLayout.ts";
import { useQueueScope } from "../state/useQueueScope.ts";
import { OPEN_SCOPE, requestStatus, scopeRows } from "../state/queueScopeStore.ts";
import { useBoardWatch } from "../state/useBoardWatch.ts";
import { useResource } from "../state/useResource.ts";
import { TaskInspector } from "./TaskInspector.tsx";
import { TaskCreatePanel } from "./TaskCreatePanel.tsx";
import { TASK_DEFAULT_ORDER, taskColumns } from "./taskColumns.tsx";
import { AttentionBar } from "./AttentionBar.tsx";
import { QueueToolbar } from "./QueueToolbar.tsx";

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
  const [scope, setScope] = useQueueScope();
  const [assignee, setAssignee] = useState("");
  // Filing a task takes the inspector's slot: one side panel at a time, and
  // the queue stays visible beside it so an id can be checked by eye.
  const [creating, setCreating] = useState(false);

  const tasks = useResource(
    () => coordination.tasks({
        status: requestStatus(scope),
        assignee: assignee || undefined,
        limit: REQUEST_LIMIT,
      }),
    [scope, assignee],
  );

  // "Open work" is narrowed here rather than in the request: `task list` takes
  // one status at a time and cannot express everything-not-done. Narrowing the
  // loaded window is the same contract the filter box already works under, and
  // the truncation notice below still reports when that window was capped.
  const scoped = useMemo(
    () => filterRows(scopeRows(tasks.data ?? [], scope), FILTER_FIELDS, filter),
    [tasks.data, scope, filter],
  );

  // Sessions, only so the stale-claim clause of needsAttention can fire. Kept
  // separate from the task load so a sessions failure quiets the highlight
  // rather than emptying the queue.
  const sessions = useResource(() => coordination.sessions({ status: "active" }), []);
  const staleSessionIds = useMemo(() => {
    const now = new Date();
    return new Set(
      (sessions.data ?? []).filter((entry) => isRecoverable(entry, now)).map((entry) => entry.id),
    );
  }, [sessions.data]);

  // Summarised over the scoped rows, so the counts describe the list the
  // operator is looking at. A strip that counted the whole board while the
  // queue showed a filtered slice would be two different answers on one screen.
  const attention = useMemo(
    () => summariseAttention(scoped, { staleSessionIds }),
    [scoped, staleSessionIds],
  );

  // Narrowing by a reason is a lens on the same rows, not another filter to
  // remember: deliberately not persisted, and cleared by its own control.
  const [reason, setReason] = useState<AttentionReason | null>(null);
  const rows = useMemo(
    () =>
      reason
        ? scoped.filter((task) => attentionReason(task, { staleSessionIds }) === reason)
        : scoped,
    [scoped, reason, staleSessionIds],
  );

  // UI-34: notice when another agent moves the board, without moving it. The
  // request is deliberately unscoped and unfiltered — the question is whether
  // the board changed, not whether this filtered view did.
  const watch = useBoardWatch(
    () => coordination.tasks({ limit: REQUEST_LIMIT }),
    tasks.data,
    { enabled: tasks.loaded },
  );

  const empty = queueEmptyState({
    scope,
    filtered: Boolean(filter),
    byAssignee: Boolean(assignee),
    loadedCount: (tasks.data ?? []).length,
  });

  const nameFor = useMemo(() => {
    const byId = new Map(agents.map((agent) => [agent.id, agent.name]));
    return (id: string) => byId.get(id) ?? id;
  }, [agents]);

  // Reassignment is not offered here. UX-ROW-ACTION-1: it lives in the
  // inspector, which is where the operator can already see who holds the claim
  // and what the task is blocked on — and offering it in both places produced
  // three names for one action across two surfaces.
  const columns = useMemo(
    // Resolved session, so the Next action column cannot offer Claim on the
    // strength of a session that has ended.
    () =>
      taskColumns(nameFor, {
        actorId: identity.actorId,
        sessionId: session.activeSessionId,
      }),
    [nameFor, identity.actorId, session.activeSessionId],
  );

  return (
    <div
      className={selectedId || creating ? "queue-layout with-inspector" : "queue-layout"}
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
        <div className="view-header view-header-with-action">
          <div>
            <h1>Tasks</h1>
            <p className="small muted">
              Work items and their current state. Ordered by priority, then most
              recently updated.
            </p>
          </div>
          {/* UI-48. Not primary: filing is common, but opening a task is
              constant, and the loudest control on the queue should not be the
              one that leaves it. */}
          <button
            type="button"
            className="view-action"
            onClick={() => {
              onSelect(null);
              setCreating(true);
            }}
            disabled={creating}
          >
            File a task
          </button>
        </div>

        {/* Above the queue, not beside the navigation: the surface that knew
            what was wrong used to be the tenth menu item, below Export, so
            noticing and acting were two motions. Held to one line — UX-SCOPE-2
            rejected an Attention workspace, and a strip that grows tiles is
            how that decision gets reversed by accident. */}
        {/* A quiet inline bar at the top of the list, per Michael's ruling —
            not a toast, which is transient, and not a badge, which does not
            say what happened. Refreshing is the operator's to do: replacing
            rows underneath them is the behaviour being complained about. */}
        {watch.summary ? (
          <div className="board-changed" role="status">
            <span>{watch.summary} since this view loaded.</span>
            <button
              type="button"
              onClick={() => {
                tasks.refresh();
                watch.dismiss();
              }}
            >
              Refresh
            </button>
            <button type="button" className="link" onClick={watch.dismiss}>
              Dismiss
            </button>
          </div>
        ) : null}

        <AttentionBar
          groups={attention}
          total={attentionTotal(attention)}
          active={reason}
          onSelect={setReason}
          scopeHint={scope === OPEN_SCOPE ? undefined : "Counted across the loaded rows."}
        />

        <QueueToolbar
          scope={scope}
          onScope={setScope}
          assignee={assignee}
          onAssignee={setAssignee}
          agents={agents}
        />

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
          emptyTitle={empty.title}
          emptyHint={empty.hint}
          // UI-45: structure, not just a coloured pill. The shared definition
          // lives in lib/attention.ts so the queue and the home view cannot
          // disagree about what needs someone.
          rowClass={(task) =>
            needsAttention(task, { staleSessionIds }) ? "needs-attention" : undefined
          }
        />
      </section>

      {creating ? (
        <>
          <div className="inspector-scrim" onClick={() => setCreating(false)} aria-hidden="true" />
          <ResizeHandle
            label="Resize new task panel"
            value={inspectorWidth}
            min={BOUNDS.inspector.min}
            max={BOUNDS.inspector.max}
            direction={-1}
            onResize={(next) => layout.setWidth("inspector", next)}
            onReset={() => layout.reset("inspector")}
          />
          <TaskCreatePanel
            existingIds={(tasks.data ?? []).map((task) => task.id)}
            agents={agents}
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              tasks.refresh();
              // Land on the thing just filed, with its inspector open.
              onSelect(id);
            }}
          />
        </>
      ) : selectedId ? (
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
