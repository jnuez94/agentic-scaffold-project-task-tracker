/**
 * A task's reviews, and the form to add one (UI-52).
 *
 * Split from TaskTabs the way DependencyList was: the tab is the host, the
 * panel is the thing. The form is always present, including on the empty
 * state — "record none" is the defect this exists to fix, so the tab must
 * never be a dead end.
 */

import type { TaskDetail } from "../api/contract.ts";
import { EnumPill } from "../components/Pill.tsx";
import { ReviewForm } from "./ReviewForm.tsx";

export function ReviewsPanel({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  const form = <ReviewForm detail={detail} onRecorded={onChanged} />;
  if (detail.reviews.length === 0) {
    // A one-line note plus the form, not the full empty-state panel: the panel
    // and the form say the same thing twice and its height pushed the submit
    // button below the fold (the UI-28 defect).
    return (
      <>
        <p className="small muted">No reviews recorded yet.</p>
        {form}
      </>
    );
  }
  return (
    <>
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
    {form}
    </>
  );
}
