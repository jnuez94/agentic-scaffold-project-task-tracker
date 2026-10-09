/**
 * The identity readout and the popover it opens (UI-43, UI-77).
 *
 * The popover sits over page content, so it closes every way an overlay
 * should: from its readout, on Escape (focus back on the readout), on a press
 * outside it — a press that is spent on closing and activates nothing beneath
 * — and, from the top bar, on any route change. Choosing an actor or a
 * session keeps it open, because choosing an actor is commonly followed by
 * choosing a session.
 */

import { useRef, type ReactNode } from "react";
import type { Agent, Session } from "../api/contract.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import { usePopoverDismiss } from "../state/usePopoverDismiss.ts";

export interface IdentityPopoverProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  summary: string;
  agents: Agent[];
  /** Already filtered to active sessions owned by the selected actor. */
  sessions: Session[];
  actorId: string | null;
  sessionId: string | null;
  onActor: (value: string | null) => void;
  onSession: (value: string | null) => void;
  sessionReason: string | null;
  /** The constrained-height disclosure is open and shows the selects inline. */
  inline: boolean;
  sessionControls?: ReactNode;
}

export function IdentityPopover(props: IdentityPopoverProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePopoverDismiss({ open: props.open, onClose: props.onClose, panel, trigger });

  const selectable = props.agents.filter(isSelectableActor);
  const retired = props.agents.filter((agent) => !isSelectableActor(agent));

  return (
    <>
      {/* Identity as a readout that expands (UI-43).
       *
       * The two selects held 836px, 68% of a bar that is 16% of the viewport
       * permanently, for a value set once. Attribution stays in the header —
       * the session travels in X-Coordination-Session, so the header is what
       * no form can disagree with — but visible and occupying two-thirds of
       * the chrome are different requirements.
       *
       * Hidden below 600px tall, where UI-16's disclosure already collapses
       * the whole toolbar and the selects render inline inside it. Two
       * mechanisms for one job at different sizes have to agree rather than
       * both fire, so exactly one of them is a control at any given size. */}
      <button
        type="button"
        className="topbar-identity-readout"
        aria-expanded={props.open}
        aria-controls="topbar-identity"
        ref={trigger}
        onClick={props.onToggle}
      >
        <span className="small muted">Acting as</span>
        <span className="topbar-identity-value">{props.summary}</span>
        <span className="topbar-identity-caret" aria-hidden="true">
          {props.open ? "▴" : "▾"}
        </span>
      </button>

      <div
        id="topbar-identity"
        ref={panel}
        className={props.open ? "topbar-identity open" : "topbar-identity"}
      >
        <div className="control">
          <label htmlFor="actor-select">Acting as</label>
          <select
            id="actor-select"
            value={props.actorId ?? ""}
            onChange={(event) => props.onActor(event.target.value || null)}
          >
            <option value="">No actor selected</option>
            {/* Grouped, not filtered. The agent list is fetched with all=1 —
                bootstrap needs it that way to detect an incompatible
                local-operator record — so retired identities arrive here too.
                Hiding them would be the wrong fix; the problem was that
                nothing distinguished them. A retired actor cannot be the
                accountable actor for a mutation, so it is disabled rather
                than silently selectable. */}
            {selectable.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agentOptionLabel(agent)}
              </option>
            ))}
            {retired.length ? (
              <optgroup label="Retired — cannot act">
                {retired.map((agent) => (
                  <option key={agent.id} value={agent.id} disabled>
                    {agentOptionLabel(agent)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>

        <div className="control">
          <label htmlFor="session-select">Active session</label>
          <select
            id="session-select"
            value={props.sessionId ?? ""}
            onChange={(event) => props.onSession(event.target.value || null)}
            disabled={!props.actorId}
            aria-describedby={
              props.sessionReason ? "session-reason" : undefined
            }
          >
            <option value="">No session</option>
            {props.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.id} · {session.harness}
              </option>
            ))}
          </select>
          {props.sessionReason ? (
            <p id="session-reason" className="small muted session-reason">
              {props.sessionReason}
            </p>
          ) : null}
        </div>

        {props.open || props.inline ? props.sessionControls : null}
      </div>
    </>
  );
}
