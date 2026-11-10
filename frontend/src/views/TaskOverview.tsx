/**
 * The inspector's Overview tab.
 *
 * Stored text is rendered as text, never markup: these records are written by
 * other agents.
 */

import type { TaskDetail } from "../api/contract.ts";
import { Field, Tags, TextBlock } from "../components/Fields.tsx";
import { absoluteTime } from "../lib/format.ts";
import { BlockedReason } from "./BlockedReason.tsx";

export function Overview({
  detail,
  onChangeAssignees,
  onEscalate,
}: {
  detail: TaskDetail;
  /** Omitted where reassignment does not apply; the control is then absent. */
  onChangeAssignees?: () => void;
  /** Opens the escalation form for this task (UI-49). */
  onEscalate?: () => void;
}) {
  // Why a task is blocked is the reason anyone opens a blocked task, so it
  // leads, directly beneath the chip, and is built from what blocks it
  // (UI-83): never from "Does not authorize", which is a boundary.
  const blocked = detail.status === "blocked";

  return (
    <>
      {/* Keyed by task: switching tasks must not show the last task's cause
       * while the next one's history loads, or after it fails. */}
      {blocked ? <BlockedReason key={detail.id} detail={detail} /> : null}

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
              id="assignees-trigger"
              type="button"
              className="record-action"
              onClick={onChangeAssignees}
            >
              Change assignees
            </button>
          ) : null}
          {onEscalate ? (
            <button id="escalate-trigger" type="button" className="record-action" onClick={onEscalate}>
              Escalate…
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
      {/* The boundary of what finishing this task allows, under the one term
          the console uses for it (UI-79, UI-83). Never shown as a reason. */}
      <Field label="Does not authorize" hideWhenEmpty>
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
