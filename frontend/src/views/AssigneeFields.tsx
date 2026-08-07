/**
 * The read-and-stage parts of the assignee editor.
 *
 * Extracted so AssigneeEditor keeps to one job — draft state, submission, and
 * error handling — and stays under the file-size limit the project holds itself
 * to. These three are presentational: they render the draft and report intent
 * upward, and hold no state of their own.
 */

import type { Agent } from "../api/contract.ts";
import {
  removalBlockedReason,
  type AssignableTask,
  type AssignmentDraft,
} from "../lib/assignment.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";

/** Who holds the task now, with what may be staged for removal. */
export function CurrentAssignees({
  task,
  agents,
  draft,
  pending,
  onToggleRemove,
}: {
  task: AssignableTask;
  agents: Agent[];
  draft: AssignmentDraft;
  pending: boolean;
  onToggleRemove: (id: string) => void;
}) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div className="field">
      <span className="field-label">Currently assigned</span>
      {task.assignees.length === 0 ? (
        <p className="small muted">Nobody. This task is unowned.</p>
      ) : (
        <ul className="assignee-list">
          {task.assignees.map((id) => {
            const agent = byId.get(id);
            const blocked = removalBlockedReason(task, id);
            const staged = draft.remove.includes(id);
            return (
              <li key={id} className={staged ? "staged-removal" : ""}>
                <span className="assignee-name">
                  {/* Glyph plus text, never colour alone. */}
                  <span aria-hidden="true">
                    {agent && !isSelectableActor(agent) ? "○" : "⬤"}
                  </span>{" "}
                  {agent ? agentOptionLabel(agent) : `${id} — unknown agent`}
                </span>
                <button
                  type="button"
                  className="link-button"
                  disabled={Boolean(blocked) || pending}
                  aria-describedby={blocked ? `blocked-${id}` : undefined}
                  onClick={() => onToggleRemove(id)}
                >
                  {staged ? "Undo remove" : "Remove"}
                </button>
                {blocked ? (
                  // Accessible text, not a tooltip: hover must not be the only
                  // way to reveal something required.
                  <p className="small muted" id={`blocked-${id}`}>
                    {blocked}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The picker, with retired agents visible but unselectable. */
export function AddAssignee({
  selectable,
  retired,
  staged,
  pending,
  onAdd,
}: {
  selectable: Agent[];
  retired: Agent[];
  staged: readonly string[];
  pending: boolean;
  onAdd: (id: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor="assignee-add">
        Add someone
      </label>
      <select
        id="assignee-add"
        value=""
        disabled={pending}
        onChange={(event) => {
          if (event.target.value) onAdd(event.target.value);
        }}
      >
        <option value="">Choose an agent…</option>
        {selectable.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agentOptionLabel(agent)}
          </option>
        ))}
        {retired.length ? (
          /* The CLI allows assigning a retired agent. The console does not:
             that is exactly how SEC-1 came to be owned by a deactivated
             identity. Anyone who genuinely needs it still has the CLI. */
          <optgroup label="Retired — cannot be assigned">
            {retired.map((agent) => (
              <option key={agent.id} value={agent.id} disabled>
                {agentOptionLabel(agent)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      {staged.length ? (
        <p className="small">
          Adding: <span className="mono">{staged.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

/** What submitting would produce, or what it would destroy. */
export function AssignmentResult({
  result,
  removing,
  unowned,
}: {
  result: string[];
  removing: readonly string[];
  unowned: boolean;
}) {
  return (
    <div className="field assignment-result">
      <span className="field-label">Result</span>
      {unowned ? (
        <p role="note" className="unowned-warning">
          <strong>This will leave the task unowned.</strong> It will appear under Unowned
          tasks on Health until someone is assigned.
        </p>
      ) : (
        <p className="mono">{result.join(", ") || "nobody"}</p>
      )}
      {removing.length ? (
        <p className="small muted">
          Removing: <span className="mono">{removing.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Who this change will be recorded against.
 *
 * Assignment is an accountable act and the audit log keeps it, so the panel
 * says whose name goes on it before the operator commits. The sessionless case
 * is stated rather than hidden: the CLI accepts a sessionless assign, so the
 * action stays available and the footer narrows its claim instead.
 */
export function AssignmentAttribution({
  actorId,
  sessionId,
  revision,
}: {
  actorId: string | null;
  sessionId: string | null;
  revision: number;
}) {
  return (
    <p className="small muted attribution">
      Acting as <span className="mono">{actorId ?? "no actor"}</span>
      {sessionId ? (
        <>
          {" "}
          in session <span className="mono">{sessionId}</span>
        </>
      ) : (
        " — no session selected, so attribution will record the actor only"
      )}
      . Revision <span className="mono">{revision}</span>.
    </p>
  );
}

/**
 * A failed save, with the one recovery the operator can act on.
 *
 * `stale_task_revision` is the only failure with a next step the console can
 * offer, so it is the only one that grows a button. Everything else states what
 * happened and leaves the draft intact.
 */
export function AssignmentError({
  text,
  stale,
  onReload,
}: {
  text: string;
  stale: boolean;
  onReload: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <p>{text}</p>
      {stale ? (
        <button type="button" onClick={onReload}>
          Reload latest
        </button>
      ) : null}
    </div>
  );
}
