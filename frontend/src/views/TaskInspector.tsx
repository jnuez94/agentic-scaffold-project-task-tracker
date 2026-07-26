/**
 * The task inspector: detail without losing queue context.
 */

import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { Agent, TaskDetail } from "../api/contract.ts";
import { ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { Field, MetricRow, Tags, TextBlock } from "../components/Fields.tsx";
import { StatusPill } from "../components/Pill.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { TaskActions } from "./TaskActions.tsx";
import { TaskTabPanel, TASK_TABS, type TaskTab } from "./TaskTabs.tsx";

export function TaskInspector({
  taskId,
  agents,
  onClose,
  onChanged,
}: {
  taskId: string;
  agents: Agent[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination } = useApp();
  const [tab, setTab] = useState<TaskTab>("overview");
  const task = useResource(() => coordination.task(taskId), [taskId]);

  const detail = task.data;

  return (
    <aside className="inspector" aria-label={`Task ${taskId}`}>
      <div className="inspector-header">
        <div>
          <span className="mono inspector-id">{taskId}</span>
          <h2 className="inspector-title">{detail?.title ?? "Loading…"}</h2>
        </div>
        <button onClick={onClose} aria-label="Close inspector" className="close">
          ✕
        </button>
      </div>

      {task.error ? (
        <div className="inspector-body">
          <ErrorBanner error={task.error} onRetry={task.refresh} />
        </div>
      ) : null}

      {!detail ? (
        task.error ? null : (
          <div className="inspector-body">
            <SkeletonRows rows={4} columns={2} />
          </div>
        )
      ) : (
        <>
          <MetricRow
            items={[
              { label: "State", value: <StatusPill status={detail.status} /> },
              { label: "Priority", value: <span className="mono">{detail.priority}</span> },
              { label: "Revision", value: <span className="mono">{detail.revision}</span> },
              { label: "Evidence", value: <span className="mono">{detail.evidence_count}</span> },
              {
                label: "Updated",
                value: (
                  <span title={absoluteTime(detail.updated_at)}>
                    {relativeTime(detail.updated_at)}
                  </span>
                ),
              },
            ]}
          />

          <div className="tabs" role="tablist" aria-label="Task detail sections">
            {TASK_TABS.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={tab === entry.id}
                aria-controls={`panel-${entry.id}`}
                tabIndex={tab === entry.id ? 0 : -1}
                className={tab === entry.id ? "tab active" : "tab"}
                onClick={() => setTab(entry.id)}
                onKeyDown={(event) => handleTabKeys(event, entry.id, setTab)}
              >
                {entry.label}
                {entry.count ? <span className="tab-count">{entry.count(detail)}</span> : null}
              </button>
            ))}
          </div>

          <div
            className="inspector-body"
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
          >
            {tab === "overview" ? (
              <Overview detail={detail} />
            ) : (
              <TaskTabPanel tab={tab} detail={detail} onChanged={onChanged} refresh={task.refresh} />
            )}
          </div>

          <TaskActions
            task={detail}
            agents={agents}
            onDone={() => {
              task.refresh();
              onChanged();
            }}
          />
        </>
      )}
    </aside>
  );
}

function Overview({ detail }: { detail: TaskDetail }) {
  return (
    <>
      <Field label="Description">
        <TextBlock text={detail.description} />
      </Field>
      <Field label="Assignees">
        {detail.assignees.length ? detail.assignees.join(", ") : <span className="muted">Unassigned</span>}
      </Field>
      <Field label="Claim">
        {detail.claimed_by ? (
          <span className="mono">
            {detail.claimed_by} · session {detail.claim_session_id}
          </span>
        ) : (
          <span className="muted">Not claimed</span>
        )}
      </Field>
      <Field label="Acceptance criteria">
        <TextBlock text={detail.acceptance_criteria} />
      </Field>
      <Field label="Next steps" hideWhenEmpty>
        {detail.next_steps ? <TextBlock text={detail.next_steps} /> : ""}
      </Field>
      <Field label="Blocked claims" hideWhenEmpty>
        {detail.blocked_claims ? <TextBlock text={detail.blocked_claims} /> : ""}
      </Field>
      <Field label="Notes" hideWhenEmpty>
        {detail.notes ? <TextBlock text={detail.notes} /> : ""}
      </Field>
      <Field label="Tags">
        <Tags value={detail.tags} />
      </Field>
      <Field label="Created">
        <span className="small">
          {absoluteTime(detail.created_at)} by <span className="mono">{detail.created_by}</span>
        </span>
      </Field>
    </>
  );
}

function handleTabKeys(
  event: KeyboardEvent,
  current: TaskTab,
  setTab: (tab: TaskTab) => void,
) {
  const index = TASK_TABS.findIndex((entry) => entry.id === current);
  if (event.key === "ArrowRight") {
    event.preventDefault();
    setTab(TASK_TABS[(index + 1) % TASK_TABS.length]!.id);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    setTab(TASK_TABS[(index - 1 + TASK_TABS.length) % TASK_TABS.length]!.id);
  }
}
