/**
 * The inspector's Overview tab.
 *
 * Stored text is rendered as text, never markup: these records are written by
 * other agents.
 */

import type { TaskDetail } from "../api/contract.ts";
import { Field, Tags, TextBlock } from "../components/Fields.tsx";
import { absoluteTime } from "../lib/format.ts";

export function Overview({ detail }: { detail: TaskDetail }) {
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
