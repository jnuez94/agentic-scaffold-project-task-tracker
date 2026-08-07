/**
 * Recovering a stale session (UI-22).
 *
 * Recovery is destructive in a way an "Are you sure?" cannot convey: it blocks
 * every task the session holds, increments their revisions, appends the reason
 * to their notes, clears the claims, and ends the session. If the session was
 * merely idle rather than abandoned, that happens to someone who is still
 * working.
 *
 * So the dialog states the age, states that age does not prove abandonment,
 * names the specific tasks that will be blocked, and requires a reason before
 * it will enable — the reason being both a CLI requirement and the thing that
 * tells whoever finds the blocked task tomorrow why it happened.
 */

import { useEffect, useRef, useState } from "react";
import type { Session, TaskListRow } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { Icon } from "../components/icons.tsx";
import { absoluteTime } from "../lib/format.ts";
import { describeAge, recoveryCaution, secondsSinceSeen, tasksClaimedBy } from "../lib/staleness.ts";
import { useApp } from "../state/AppContext.tsx";
import { useFocusTrap } from "../state/useFocusTrap.ts";

interface Recovered {
  id: string;
  status: string;
  revision: number;
}

export function SessionRecovery({
  session,
  tasks,
  actorId,
  onClose,
  onRecovered,
}: {
  session: Session;
  /** Loaded tasks, used to name what recovery will block. */
  tasks: readonly TaskListRow[];
  actorId: string | null;
  onClose: () => void;
  onRecovered: () => void;
}) {
  const { coordination, announce } = useApp();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | undefined>();
  const [recovered, setRecovered] = useState<Recovered[] | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useFocusTrap(sheet, true);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const claimed = tasksClaimedBy(tasks, session.id);
  const age = secondsSinceSeen(session.last_seen_at);
  const canSubmit = Boolean(actorId) && reason.trim().length > 0 && !pending;

  const requestClose = () => {
    if (pending) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !actorId) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await coordination.recoverSession(session.id, {
        actor: actorId,
        reason: reason.trim(),
      });
      const list = Array.isArray(result["recovered_tasks"])
        ? (result["recovered_tasks"] as Recovered[])
        : [];
      setRecovered(list);
      announce(
        `Session ${session.id} recovered. ${list.length} task${list.length === 1 ? "" : "s"} blocked.`,
      );
      onRecovered();
    } catch (caught) {
      // The reason survives: it is the operator's words, and retyping it after
      // a transport failure is the fastest way to get a worse one.
      setError(
        caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <aside
      className="sheet"
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recover-heading"
    >
      <div className="sheet-header">
        <h2 id="recover-heading" ref={heading} tabIndex={-1}>
          Recover session
        </h2>
        <button onClick={requestClose} aria-label="Close session recovery" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <form className="sheet-body" onSubmit={(event) => void submit(event)}>
        {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}

        {recovered ? (
          <div className="sent-receipt" role="status">
            <p className="sent-title">Session ended</p>
            <p className="small mono">{session.id}</p>
            {recovered.length === 0 ? (
              <p className="small muted">It held no claimed tasks, so nothing was blocked.</p>
            ) : (
              <>
                <p className="small muted">
                  {recovered.length} task{recovered.length === 1 ? "" : "s"} blocked:
                </p>
                <ul className="record-list">
                  {recovered.map((task) => (
                    <li key={task.id}>
                      <span className="mono">{task.id}</span>
                      <span className="small"> — {task.status}, revision {task.revision}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" onClick={requestClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="field">
              <span className="field-label">Session</span>
              <p className="mono">{session.id}</p>
              <p className="small muted">
                {session.agent_id} · {session.harness} · last seen {describeAge(age)}{" "}
                <span title={absoluteTime(session.last_seen_at)}>
                  ({absoluteTime(session.last_seen_at)})
                </span>
              </p>
            </div>

            <p className="recovery-caution" role="note">
              {recoveryCaution(session.last_seen_at)}
            </p>

            <div className="field">
              <span className="field-label">
                What recovery does {claimed.length > 0 ? `to ${claimed.length} task${claimed.length === 1 ? "" : "s"}` : ""}
              </span>
              {claimed.length === 0 ? (
                <p className="small muted">
                  This session holds no claimed tasks, so recovery only ends the session.
                </p>
              ) : (
                <>
                  <p className="small">
                    Each of these is set to <strong>blocked</strong>, has its revision
                    incremented, has your reason appended to its notes, and loses its claim.
                    The session is then ended and the intervention audited.
                  </p>
                  <ul className="record-list">
                    {claimed.map((task) => (
                      <li key={task.id}>
                        <span className="mono">{task.id}</span>
                        <span className="small"> — {task.title}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <label className="field" htmlFor="recover-reason">
              <span className="field-label">Reason</span>
              <textarea
                id="recover-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this session is being recovered"
                aria-describedby="recover-reason-hint"
              />
              <span id="recover-reason-hint" className="small muted">
                Required. Appended to every blocked task, so write it for whoever finds one
                tomorrow.
              </span>
            </label>

            {!actorId ? (
              <p className="small muted" id="recover-actor-hint">
                Select an actor in the header: recovery is an accountable intervention and is
                recorded against whoever performs it.
              </p>
            ) : null}

            <div className="sheet-actions">
              <button
                type="submit"
                className="primary"
                disabled={!canSubmit}
                aria-describedby={!actorId ? "recover-actor-hint" : undefined}
              >
                {pending ? "Recovering…" : "Recover session"}
              </button>
              <button type="button" onClick={requestClose} disabled={pending}>
                Cancel
              </button>
            </div>
          </>
        )}
      </form>
    </aside>
  );
}
