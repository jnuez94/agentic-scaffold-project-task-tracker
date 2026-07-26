/**
 * The Assignees / Claim cell.
 *
 * Assignment and claim are distinct facts and are shown as such: an assignee
 * is who the work belongs to, a claim is who is holding it right now in one
 * specific session.
 */

import type { TaskListRow } from "../api/contract.ts";
import { initials } from "../lib/labels.ts";

export function Owners({
  task,
  nameFor,
}: {
  task: TaskListRow;
  nameFor: (id: string) => string;
}) {
  if (task.assignees.length === 0 && !task.claimed_by) {
    return <span className="muted small">Unassigned</span>;
  }
  return (
    <div className="owners">
      {task.assignees.map((id) => (
        <span className="owner" key={id} title={`Assignee: ${id}`}>
          <span className="avatar" aria-hidden="true">
            {initials(nameFor(id))}
          </span>
          <span className="small">{nameFor(id)}</span>
        </span>
      ))}
      {task.claimed_by ? (
        <span
          className="claim-badge"
          title={`Claim session: ${task.claim_session_id ?? "unknown"}`}
        >
          Claimed by {nameFor(task.claimed_by)}
        </span>
      ) : null}
    </div>
  );
}
