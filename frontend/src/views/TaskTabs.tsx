/**
 * Inspector tabs other than Overview.
 *
 * Messages is the newest of them (UI-74). It was withheld while `message list`
 * filtered by recipient only, because a per-task list would have been wrong
 * or silently partial; 1.4.0's `--task` filter made it honest.
 */

import { useState } from "react";
import type { TaskDetail } from "../api/contract.ts";
import { EmptyState, ErrorBanner } from "../components/Feedback.tsx";
import { DependencyList } from "./DependencyList.tsx";
import { ReviewsPanel } from "./ReviewsPanel.tsx";
import { EnumPill } from "../components/Pill.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { humanize } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { AddEvidenceForm } from "./AddEvidenceForm.tsx";
import { DependencyForm } from "./DependencyForm.tsx";
import { TaskMessagesPanel } from "./TaskMessagesPanel.tsx";

export type TaskTab =
  | "overview"
  | "evidence"
  | "dependencies"
  | "reviews"
  | "messages"
  | "activity";

export const TASK_TABS: {
  id: TaskTab;
  label: string;
  count?: (detail: TaskDetail) => number;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence", count: (d) => d.evidence.length },
  { id: "dependencies", label: "Dependencies", count: (d) => d.dependencies.length },
  { id: "reviews", label: "Reviews", count: (d) => d.reviews.length },
  // No count: the detail row carries no messages, and a count would cost a
  // request per inspected task before the tab is opened.
  { id: "messages", label: "Messages" },
  { id: "activity", label: "Activity" },
];

export function TaskTabPanel({
  tab,
  detail,
  nameFor,
  onChanged,
  refresh,
}: {
  tab: TaskTab;
  detail: TaskDetail;
  /** Agent display names for the Messages tab; ids fall through unchanged. */
  nameFor: (id: string) => string;
  onChanged: () => void;
  refresh: () => void;
}) {
  if (tab === "evidence") {
    return <EvidencePanel detail={detail} onAdded={() => { refresh(); onChanged(); }} />;
  }
  if (tab === "dependencies") {
    return (
      <DependenciesPanel detail={detail} onChanged={() => { refresh(); onChanged(); }} />
    );
  }
  if (tab === "reviews") return <ReviewsPanel detail={detail} onChanged={() => { refresh(); onChanged(); }} />;
  if (tab === "messages") return <TaskMessagesPanel taskId={detail.id} nameFor={nameFor} />;
  return <ActivityPanel taskId={detail.id} />;
}

function EvidencePanel({ detail, onAdded }: { detail: TaskDetail; onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      {detail.evidence.length === 0 ? (
        <EmptyState
          title="No evidence yet"
          hint="A task cannot move to done until it has at least one evidence record."
        />
      ) : (
        <ul className="record-list">
          {detail.evidence.map((item) => (
            <li key={item.id}>
              <div className="record-head">
                <EnumPill value={item.evidence_type} />
                <span className="small muted" title={absoluteTime(item.created_at)}>
                  {relativeTime(item.created_at)} · {item.added_by}
                </span>
              </div>
              <div className="record-uri mono">{item.uri}</div>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddEvidenceForm
          taskId={detail.id}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            onAdded();
          }}
        />
      ) : (
        <button className="primary" onClick={() => setAdding(true)}>
          Add evidence
        </button>
      )}
    </>
  );
}

function DependenciesPanel({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  // The form is always present, including on the empty state: "record none"
  // was the defect (UI-50), so the tab should never be a dead end.
  const form = (
    <DependencyForm
      // Keyed by the task, so switching tasks remounts the form with empty
      // state. Without this the draft and — worse — its validation error
      // survive the switch: "A task cannot depend on itself" followed UI-48
      // onto UI-55, where that id is a perfectly valid dependency, so the form
      // was asserting something false about the task now in front of you.
      key={detail.id}
      taskId={detail.id}
      existing={detail.dependencies}
      onAdded={onChanged}
    />
  );
  if (detail.dependencies.length === 0) {
    // A one-line note rather than the full EmptyState panel. The panel and the
    // form say the same thing twice, and its height pushed the submit button
    // below the fold — the UI-28 defect, reintroduced by stacking them.
    return (
      <>
        <p className="small muted">This task does not wait on any other task.</p>
        {form}
      </>
    );
  }
  return (
    <>
      <DependencyList
        taskId={detail.id}
        dependencies={detail.dependencies}
        onChanged={onChanged}
      />
      {form}
    </>
  );
}


function ActivityPanel({ taskId }: { taskId: string }) {
  const { coordination } = useApp();
  const audit = useResource(() => coordination.audit({ object_id: taskId, limit: 50 }), [taskId]);

  if (audit.error) return <ErrorBanner error={audit.error} onRetry={audit.refresh} />;
  const entries = audit.data ?? [];
  if (audit.loaded && entries.length === 0) {
    return <EmptyState title="No recorded activity" />;
  }
  return (
    <ul className="timeline">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <div className="small">
              <strong>{humanize(entry.action)}</strong> by <span className="mono">{entry.actor}</span>
            </div>
            <div className="small muted" title={absoluteTime(entry.created_at)}>
              {relativeTime(entry.created_at)}
              {entry.session_id ? ` · session ${entry.session_id}` : ""}
            </div>
            {entry.detail ? <div className="small muted">{entry.detail}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
