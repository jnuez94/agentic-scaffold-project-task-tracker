/**
 * Retiring and restoring an agent (UI-30).
 *
 * The action is small; the disclosure is the feature. Retirement destroys
 * nothing and is reversible, but it does not unassign work — so retiring an
 * agent that still owns tasks quietly creates the exact state that blocked this
 * release: codex-security retired, still holding SEC-1, and unable to act on
 * it. The confirmation therefore leads with what the agent still owns.
 *
 * A warning rather than a block. Releasing work deliberately is legitimate —
 * Mikhail did it at sign-off so an incoming agent could claim it — but the
 * operator should choose it rather than discover it.
 *
 * Spec: docs/ux-retire-agent-spec.md sections 4 and 5.
 */

import { useEffect, useRef, useState } from "react";
import type { Agent, TaskListRow } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { Icon } from "../components/icons.tsx";
import { outstandingAssignments, retireErrorCopy } from "../lib/retirement.ts";
import { useApp } from "../state/AppContext.tsx";
import { useFocusTrap } from "../state/useFocusTrap.ts";

export function AgentRetirement({
  agent,
  tasks,
  onClose,
  onChanged,
}: {
  agent: Agent;
  tasks: readonly TaskListRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination, identity, session, announce } = useApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useFocusTrap(sheet, true);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const retiring = agent.status === "active";
  const outstanding = retiring ? outstandingAssignments(tasks, agent.id) : [];

  const submit = async () => {
    if (pending || !identity.actorId) return;
    setPending(true);
    setError(null);
    try {
      // One call. Agents carry no revision, so there is no stale-revision path.
      await coordination.updateAgent(agent.id, {
        status: retiring ? "inactive" : "active",
        actor: identity.actorId,
      });
      announce(
        retiring
          ? `${agent.name} is retired. It can no longer start sessions or claim work.`
          : `${agent.name} is active again.`,
      );
      onChanged();
      onClose();
    } catch (caught) {
      const failure =
        caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      // No automatic retry; the dialog stays open with the reason.
      setError(retireErrorCopy(failure.code, failure.message, agent));
    } finally {
      setPending(false);
    }
  };

  // The consequence is in the accessible name, so a screen-reader operator
  // hears it before activating rather than after.
  const confirmLabel = retiring
    ? outstanding.length
      ? `Retire agent, leaving ${outstanding.length} assigned task${outstanding.length === 1 ? "" : "s"}`
      : "Retire agent"
    : "Restore to active";

  return (
    <aside
      className="sheet"
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby="retire-heading"
    >
      <div className="sheet-header">
        <h2 id="retire-heading" ref={heading} tabIndex={-1}>
          {retiring ? "Retire" : "Restore"} {agent.name} · {agent.id}
        </h2>
        <button onClick={() => !pending && onClose()} aria-label="Close" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="sheet-body">
        {error ? (
          <div className="error-banner" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        <p>
          {retiring ? (
            <>
              A retired agent cannot start a session or claim work.{" "}
              <strong>Nothing is deleted</strong>, and you can restore it to active at any
              time.
            </>
          ) : (
            <>
              Restoring makes this agent able to start sessions and claim work again. Its
              existing assignments are unchanged.
            </>
          )}
        </p>

        {retiring && outstanding.length > 0 ? (
          <div className="retirement-warning" role="note">
            <p>
              <strong>
                Still assigned to {outstanding.length} task
                {outstanding.length === 1 ? "" : "s"}
              </strong>
            </p>
            <ul className="record-list">
              {outstanding.map((task) => (
                <li key={task.id}>
                  <a href={`#/tasks/${task.id}`} className="mono">
                    {task.id}
                  </a>
                  <span className="small"> — {task.title}</span>
                </li>
              ))}
            </ul>
            <p className="small">
              Retiring does not unassign them. Work left with a retired agent cannot be
              picked up until someone else is assigned.
            </p>
          </div>
        ) : null}

        <p className="small muted attribution">
          Acting as <span className="mono">{identity.actorId ?? "no actor"}</span>
          {session.activeSessionId ? (
            <>
              {" "}
              in session <span className="mono">{session.activeSessionId}</span>
            </>
          ) : null}
          .
        </p>

        <div className="sheet-actions">
          <button
            type="button"
            className="primary"
            disabled={pending || !identity.actorId}
            aria-label={confirmLabel}
            onClick={() => void submit()}
          >
            {pending ? "Working…" : retiring ? "Retire agent" : "Restore to active"}
          </button>
          <button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
        </div>
      </div>
    </aside>
  );
}
