/**
 * Inspector tabs other than Overview.
 *
 * There is no Messages tab. `message list` filters by recipient only, never by
 * task, so a per-task message list would either be wrong or silently partial
 * (FE-ARCH-REVIEW-1 item 3). Messages remain browsable in their own view.
 */

import { useState } from "react";
import type { TaskDetail } from "../api/contract.ts";
import { EmptyState, ErrorBanner } from "../components/Feedback.tsx";
import { EnumPill } from "../components/Pill.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { humanize } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { AddEvidenceForm } from "./AddEvidenceForm.tsx";

export type TaskTab = "overview" | "evidence" | "dependencies" | "reviews" | "activity";

export const TASK_TABS: {
  id: TaskTab;
  label: string;
  count?: (detail: TaskDetail) => number;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence", count: (d) => d.evidence.length },
  { id: "dependencies", label: "Dependencies", count: (d) => d.dependencies.length },
  { id: "reviews", label: "Reviews", count: (d) => d.reviews.length },
  { id: "activity", label: "Activity" },
];

export function TaskTabPanel({
  tab,
  detail,
  onChanged,
  refresh,
}: {
  tab: TaskTab;
  detail: TaskDetail;
  onChanged: () => void;
  refresh: () => void;
}) {
  if (tab === "evidence") {
    return <EvidencePanel detail={detail} onAdded={() => { refresh(); onChanged(); }} />;
  }
  if (tab === "dependencies") return <DependenciesPanel detail={detail} />;
  if (tab === "reviews") return <ReviewsPanel detail={detail} />;
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

function DependenciesPanel({ detail }: { detail: TaskDetail }) {
  if (detail.dependencies.length === 0) {
    return <EmptyState title="No dependencies" hint="This task does not wait on any other task." />;
  }
  return (
    <ul className="record-list">
      {detail.dependencies.map((dependency) => (
        <li key={`${dependency.depends_on_task_id}-${dependency.dependency_type}`}>
          <div className="record-head">
            <span className="mono">{dependency.depends_on_task_id}</span>
            <EnumPill value={dependency.dependency_type} />
            <EnumPill value={dependency.status} />
          </div>
          {dependency.rationale ? <p className="small">{dependency.rationale}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function ReviewsPanel({ detail }: { detail: TaskDetail }) {
  if (detail.reviews.length === 0) {
    return <EmptyState title="No reviews recorded" hint="Reviews are added through the CLI or the Reviews view." />;
  }
  return (
    <ul className="record-list">
      {detail.reviews.map((review) => (
        <li key={review.id}>
          <div className="record-head">
            <span className="mono">{review.id}</span>
            <EnumPill value={review.decision} />
            <span className="small muted">{review.reviewer_id}</span>
          </div>
          <p className="small">
            <strong>Scope:</strong> {review.scope}
          </p>
          {review.required_changes ? (
            <p className="small">
              <strong>Required changes:</strong> {review.required_changes}
            </p>
          ) : null}
          {review.blocked_claims ? (
            <p className="small muted">
              <strong>Does not authorize:</strong> {review.blocked_claims}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ActivityPanel({ taskId }: { taskId: string }) {
  const { coordination } = useApp();
  const audit = useResource(() => coordination.audit({ object_id: taskId, limit: 50 }), [taskId]);

  if (audit.error) return <ErrorBanner error={audit.error} onRetry={audit.refresh} />;
  const entries = audit.data?.entries ?? [];
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
