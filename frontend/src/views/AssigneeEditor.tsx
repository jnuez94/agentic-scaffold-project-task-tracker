/**
 * Changing who is responsible for a task (UI-28).
 *
 * Inline in the inspector rather than a modal, because the operator has to keep
 * seeing the task while deciding who should hold it.
 *
 * The panel's job is to answer three questions the CLI can only answer by
 * refusing: who holds this now and which of them is retired, who may legally be
 * added, and what the result will be. Assignment is not claiming — assignment
 * says who is responsible, a claim says who is actively working under a session
 * — and this panel must not blur the two.
 *
 * Spec: .documents/ux-reassign-work-spec.md
 */

import { useEffect, useRef, useState } from "react";
import type { Agent, TaskDetail } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { Icon } from "../components/icons.tsx";
import {
  addCandidates,
  assignErrorCopy,
  buildAssignRequest,
  EMPTY_DRAFT,
  hasPendingChange,
  removalBlockedReason,
  resultingAssignees,
  wouldLeaveUnowned,
  type AssignmentDraft,
} from "../lib/assignment.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";

export function AssigneeEditor({
  task,
  agents,
  onClose,
  onSaved,
}: {
  task: TaskDetail;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { coordination, identity, session, announce } = useApp();
  const [draft, setDraft] = useState<AssignmentDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; stale: boolean } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const { selectable, retired } = addCandidates(agents, task, draft);
  const result = resultingAssignees(task, draft);
  const unowned = wouldLeaveUnowned(task, draft);
  const dirty = hasPendingChange(draft);

  const requestClose = () => {
    if (pending) return;
    // No silent loss: a pending edit is confirmed before it is discarded.
    if (dirty && !globalThis.confirm("Discard these assignee changes?")) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const toggleRemove = (id: string) =>
    setDraft((current) => ({
      ...current,
      remove: current.remove.includes(id)
        ? current.remove.filter((other) => other !== id)
        : [...current.remove, id],
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || pending || !identity.actorId) return;
    setPending(true);
    setError(null);
    try {
      const saved = await coordination.assignTask(
        task.id,
        buildAssignRequest(task, draft, identity.actorId),
      );
      announce(
        `Assignees updated. Now: ${(saved.assignees ?? result).join(", ") || "nobody"}. ` +
          `Revision ${saved.revision}.`,
      );
      setDraft(EMPTY_DRAFT);
      onSaved();
      onClose();
    } catch (caught) {
      const failure =
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", String(caught), 0);
      // The draft survives; nothing is retried automatically.
      setError({
        text: assignErrorCopy(
          failure.code,
          failure.message,
          subjectOf(failure, task),
        ),
        stale: failure.code === "stale_task_revision",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="assignee-editor" aria-labelledby="assignees-heading">
      <div className="sheet-header">
        <h3 id="assignees-heading" ref={heading} tabIndex={-1}>
          Change assignees
        </h3>
        <button
          onClick={requestClose}
          aria-label="Close assignee editor"
          className="close"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <form onSubmit={submit}>
        {error ? (
          <div className="error-banner" role="alert">
            <p>{error.text}</p>
            {error.stale ? (
              <button type="button" onClick={onSaved}>
                Reload latest
              </button>
            ) : null}
          </div>
        ) : null}

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
                      {agent
                        ? agentOptionLabel(agent)
                        : `${id} — unknown agent`}
                    </span>
                    <button
                      type="button"
                      className="link-button"
                      disabled={Boolean(blocked) || pending}
                      aria-describedby={blocked ? `blocked-${id}` : undefined}
                      onClick={() => toggleRemove(id)}
                    >
                      {staged ? "Undo remove" : "Remove"}
                    </button>
                    {blocked ? (
                      // Accessible text, not a tooltip: hover must not be the
                      // only way to reveal something required.
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

        <div className="field">
          <label className="field-label" htmlFor="assignee-add">
            Add someone
          </label>
          <select
            id="assignee-add"
            value=""
            disabled={pending}
            onChange={(event) => {
              const id = event.target.value;
              if (id)
                setDraft((current) => ({
                  ...current,
                  add: [...current.add, id],
                }));
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
          {draft.add.length ? (
            <p className="small">
              Adding: <span className="mono">{draft.add.join(", ")}</span>
            </p>
          ) : null}
        </div>

        <div className="field assignment-result">
          <span className="field-label">Result</span>
          {unowned ? (
            <p role="note" className="unowned-warning">
              <strong>This will leave the task unowned.</strong> It will appear
              under Unowned tasks on Health until someone is assigned.
            </p>
          ) : (
            <p className="mono">{result.join(", ") || "nobody"}</p>
          )}
          {draft.remove.length ? (
            <p className="small muted">
              Removing: <span className="mono">{draft.remove.join(", ")}</span>
            </p>
          ) : null}
        </div>

        <p className="small muted attribution">
          Acting as{" "}
          <span className="mono">{identity.actorId ?? "no actor"}</span>
          {session.activeSessionId ? (
            <>
              {" "}
              in session <span className="mono">{session.activeSessionId}</span>
            </>
          ) : (
            " — no session selected, so attribution will record the actor only"
          )}
          . Revision <span className="mono">{task.revision}</span>.
        </p>

        <div className="sheet-actions">
          <button
            type="submit"
            className="primary"
            disabled={!dirty || pending || !identity.actorId}
          >
            {pending ? "Saving…" : "Save assignees"}
          </button>
          <button type="button" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

/** The agent an error is about, when the code identifies one. */
function subjectOf(failure: ApiError, task: TaskDetail): string | undefined {
  if (failure.code === "task_claim_owner_mismatch")
    return task.claimed_by ?? undefined;
  return undefined;
}
