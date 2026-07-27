/**
 * The inspector's Overview tab.
 *
 * Stored text is rendered as text, never markup: these records are written by
 * other agents.
 */

import type { TaskDetail } from "../api/contract.ts";
import { Field, Tags, TextBlock } from "../components/Fields.tsx";
import { absoluteTime } from "../lib/format.ts";

export function Overview({
  detail,
  onChangeAssignees,
}: {
  detail: TaskDetail;
  /** Omitted where reassignment does not apply; the control is then absent. */
  onChangeAssignees?: () => void;
}) {
  // Why a task is blocked is the reason anyone opens a blocked task, and it sat
  // sixth and seventh in a scroll region showing a fraction of its content: the
  // operator saw a Blocked chip and had to go looking for the sentence that
  // explains it. Promoted directly beneath the chip, and left in place below
  // too — this is an answer offered early, not a field moved.
  const blocked = detail.status === "blocked";
  const reason = detail.blocked_claims?.trim() || detail.notes?.trim() || "";

  return (
    <>
      {blocked ? (
        <div className="blocked-reason" role="note">
          <span className="field-label">Why this is blocked</span>
          {reason ? (
            <TextBlock text={reason} />
          ) : (
            <p className="small muted">
              No blocking reason was recorded. The task's state says blocked;
              nothing on the record says why.
            </p>
          )}
        </div>
      ) : null}

      <Field label="Description">
        <TextBlock text={detail.description} />
      </Field>
      <Field label="Assignees">
        <span className="assignees-value">
          {detail.assignees.length ? (
            detail.assignees.join(", ")
          ) : (
            <span className="muted">Unassigned</span>
          )}
          {/* Primary entry point per the spec: the operator is already looking
              at the task and its current owners. Not offered from the queue
              row, which has neither the revision nor the claim state. */}
          {onChangeAssignees ? (
            <button
              type="button"
              className="link-button"
              onClick={onChangeAssignees}
            >
              Change assignees
            </button>
          ) : null}
        </span>
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
        {detail.blocked_claims ? (
          <TextBlock text={detail.blocked_claims} />
        ) : (
          ""
        )}
      </Field>
      <Field label="Notes" hideWhenEmpty>
        {detail.notes ? <TextBlock text={detail.notes} /> : ""}
      </Field>
      <Field label="Tags">
        <Tags value={detail.tags} />
      </Field>
      <Field label="Created">
        <span className="small">
          {absoluteTime(detail.created_at)} by{" "}
          <span className="mono">{detail.created_by}</span>
        </span>
      </Field>
    </>
  );
}
