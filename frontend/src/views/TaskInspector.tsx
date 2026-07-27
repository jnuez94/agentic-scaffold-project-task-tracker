/**
 * The task inspector: detail without losing queue context.
 */

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Agent } from "../api/contract.ts";
import { ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { MetricRow } from "../components/Fields.tsx";
import { StatusPill } from "../components/Pill.tsx";
import { Icon } from "../components/icons.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { TaskActions } from "./TaskActions.tsx";
import { AssigneeEditor } from "./AssigneeEditor.tsx";
import { Overview } from "./TaskOverview.tsx";
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
  const [editingAssignees, setEditingAssignees] = useState(false);
  // Focus returns to the control that opened the panel, per spec section 8.
  const assigneeTrigger = useRef<HTMLButtonElement | null>(null);
  const task = useResource(() => coordination.task(taskId), [taskId]);
  const panel = useRef<HTMLElement>(null);

  // Escape closes the inspector. It is an overlay below 1280px, and an overlay
  // that cannot be dismissed from the keyboard traps the operator.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus to the panel when it opens so the next Tab lands inside it.
  useEffect(() => {
    panel.current?.focus();
  }, [taskId]);

  const detail = task.data;

  return (
    <aside
      className="inspector"
      aria-label={`Task ${taskId}`}
      ref={panel}
      tabIndex={-1}
    >
      <button className="inspector-back" onClick={onClose}>
        <Icon name="back" size={16} />
        Back to queue
      </button>
      <div className="inspector-header">
        <div>
          <span className="mono inspector-id">{taskId}</span>
          <h2 className="inspector-title">{detail?.title ?? "Loading…"}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="close"
        >
          <Icon name="close" size={16} />
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
              {
                label: "Priority",
                value: <span className="mono">{detail.priority}</span>,
              },
              {
                label: "Revision",
                value: <span className="mono">{detail.revision}</span>,
              },
              {
                label: "Evidence",
                value: <span className="mono">{detail.evidence_count}</span>,
              },
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

          <div
            className="tabs"
            role="tablist"
            aria-label="Task detail sections"
          >
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
                {entry.count ? (
                  <span className="tab-count">{entry.count(detail)}</span>
                ) : null}
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
              <>
                {editingAssignees ? (
                  <AssigneeEditor
                    task={detail}
                    agents={agents}
                    onClose={() => {
                      setEditingAssignees(false);
                      assigneeTrigger.current?.focus();
                    }}
                    onSaved={() => {
                      task.refresh();
                      onChanged();
                    }}
                  />
                ) : null}
                <Overview
                  detail={detail}
                  onChangeAssignees={(event?: unknown) => {
                    assigneeTrigger.current =
                      (event as { currentTarget?: HTMLButtonElement })
                        ?.currentTarget ?? null;
                    setEditingAssignees(true);
                  }}
                />
              </>
            ) : (
              <TaskTabPanel
                tab={tab}
                detail={detail}
                onChanged={onChanged}
                refresh={task.refresh}
              />
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
