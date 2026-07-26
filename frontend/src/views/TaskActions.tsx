/**
 * The inspector footer: attribution, valid next actions, and conflict recovery.
 *
 * Only actions the contract allows from the current state are rendered, and an
 * action that would fail a precondition is shown disabled with the reason. A
 * stale-revision conflict keeps the operator's note in memory and offers an
 * explicit reload — it never retries automatically.
 */

import { useState } from "react";
import type { Agent, TaskDetail, TaskStatus } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { availableActions, type TaskAction } from "../lib/transitions.ts";
import { useApp } from "../state/AppContext.tsx";

const SETUP_PENDING = "Waiting for identity setup to finish.";

export function TaskActions({
  task,
  agents,
  onDone,
}: {
  task: TaskDetail;
  agents: Agent[];
  onDone: () => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const [note, setNote] = useState("");
  const [error, setError] = useState<ApiError | undefined>();
  const [busy, setBusy] = useState<TaskStatus | null>(null);

  const actions = availableActions(task, {
    actorId: identity.actorId,
    sessionId: identity.sessionId,
  }).map((action) =>
    mutationsEnabled
      ? action
      : { ...action, blockedReason: action.blockedReason ?? SETUP_PENDING },
  );

  const actorName = agents.find((agent) => agent.id === identity.actorId)?.name;

  const run = async (action: TaskAction) => {
    setBusy(action.target);
    setError(undefined);
    try {
      await dispatch(action);
      announce(`${task.id} moved to ${action.target}.`);
      setNote("");
      onDone();
    } catch (caught) {
      // The note is deliberately preserved so a conflict costs no typing.
      setError(caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0));
    } finally {
      setBusy(null);
    }
  };

  const dispatch = async (action: TaskAction) => {
    const actor = identity.actorId;
    if (!actor) throw new ApiError("invalid_actor", "Select an actor first.", 400);

    if (action.kind === "claim") {
      return coordination.claimTask(task.id, { agent: actor, if_revision: task.revision });
    }
    const body: Record<string, unknown> = { actor, if_revision: task.revision };
    if (note.trim()) body["note"] = note;
    if (action.kind === "release") {
      return coordination.releaseTask(task.id, { ...body, to: action.target });
    }
    return coordination.setTaskStatus(task.id, { ...body, status: action.target });
  };

  return (
    <div className="inspector-footer">
      {error ? (
        error.isStaleRevision ? (
          <ConflictBanner
            error={error}
            currentRevision={task.revision}
            onReload={() => {
              setError(undefined);
              onDone();
            }}
          />
        ) : (
          <ErrorBanner error={error} onDismiss={() => setError(undefined)} />
        )
      ) : null}

      {task.status === "done" ? (
        <p className="small muted">This task is done. Done is terminal; there is no further status action.</p>
      ) : (
        <>
          <div className="control">
            <label htmlFor="transition-note">Transition note (optional)</label>
            <textarea
              id="transition-note"
              value={note}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Recorded in the task notes and the audit log."
            />
          </div>

          <div className="action-row">
            {actions.map((action) => (
              <button
                key={action.target}
                className={action.primary && !action.blockedReason ? "primary" : ""}
                disabled={Boolean(action.blockedReason) || busy !== null}
                title={action.blockedReason}
                onClick={() => run(action)}
              >
                {busy === action.target ? "Working…" : action.label}
              </button>
            ))}
          </div>

          {actions
            .filter((action) => action.blockedReason)
            .map((action) => (
              <p className="small muted" key={`${action.target}-reason`}>
                <strong>{action.label}:</strong> {action.blockedReason}
              </p>
            ))}
        </>
      )}

      <div className="attribution small muted">
        <span>
          Acting as{" "}
          <span className="mono">{identity.actorId ? (actorName ?? identity.actorId) : "no actor"}</span>
        </span>
        <span>
          Session <span className="mono">{identity.sessionId ?? "none"}</span>
        </span>
        <span>
          Revision <span className="mono">{task.revision}</span>
        </span>
      </div>
    </div>
  );
}

function ConflictBanner({
  error,
  currentRevision,
  onReload,
}: {
  error: ApiError;
  currentRevision: number;
  onReload: () => void;
}) {
  const actual = error.actualRevision;
  return (
    <div className="conflict" role="alert">
      <div>
        <p className="conflict-title">
          {actual ? `Task changed to revision ${actual}` : "This task changed"}
        </p>
        <p className="small">
          You submitted revision {currentRevision}. Reload latest; your draft will be preserved.
        </p>
      </div>
      <button onClick={onReload}>Reload latest</button>
    </div>
  );
}
