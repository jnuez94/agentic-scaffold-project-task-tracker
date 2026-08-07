/**
 * Top bar: filter box, identity selection, and refresh.
 *
 * The search box is labelled "Filter loaded rows" rather than "Search",
 * because the CLI has no cross-entity search and no tag filter. Calling it
 * search would imply it covers records that are not on screen.
 */

import { useState } from "react";
import type { Agent, Session } from "../api/contract.ts";
import { relativeTime } from "../lib/format.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import { Icon } from "./icons.tsx";

export interface TopBarProps {
  filter: string;
  onFilter: (value: string) => void;
  filterPlaceholder: string;
  agents: Agent[];
  sessions: Session[];
  actorId: string | null;
  sessionId: string | null;
  onActor: (value: string | null) => void;
  onSession: (value: string | null) => void;
  onRefresh: () => void;
  lastUpdated: Date | undefined;
  busy: boolean;
  /** The single explanation shown wherever a session is required. */
  sessionReason: string | null;
  broadcastRef: React.RefObject<HTMLButtonElement | null>;
  broadcastDisabledReason: string | null;
  onBroadcast: () => void;
}

export function TopBar(props: TopBarProps) {
  // Already filtered to active sessions owned by the selected actor.
  const sessionsForActor = props.sessions;
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const selectable = props.agents.filter(isSelectableActor);
  const retired = props.agents.filter((agent) => !isSelectableActor(agent));

  const actorName = props.agents.find(
    (agent) => agent.id === props.actorId,
  )?.name;
  // Accountability is never hidden: even collapsed, the control itself says who
  // is acting and whether a session backs them.
  const identitySummary = `${actorName ?? "No actor"} · ${props.sessionId ?? "no session"}`;

  return (
    <header className={identityOpen ? "topbar identity-open" : "topbar"}>
      {/* Only rendered as a control at constrained heights, where the toolbar
          would otherwise wrap to several times its height, scroll, and slice
          its own selects in half. Above that it is display:none and the panel
          below is display:contents, so the ordinary layout is untouched. */}
      <button
        type="button"
        className="topbar-disclosure"
        aria-expanded={panelOpen}
        aria-controls="topbar-panel"
        onClick={() => setPanelOpen((open) => !open)}
      >
        <Icon name="search" size={14} />
        <span>Filters and identity</span>
        <span className="small muted topbar-disclosure-identity">
          {identitySummary}
        </span>
      </button>

      <div
        id="topbar-panel"
        className={panelOpen ? "topbar-panel open" : "topbar-panel"}
      >
        <div className="topbar-filter">
          <label htmlFor="row-filter" className="visually-hidden">
            Filter loaded rows
          </label>
          <span className="topbar-glyph">
            <Icon name="search" size={16} />
          </span>
          <input
            id="row-filter"
            type="search"
            value={props.filter}
            placeholder={props.filterPlaceholder}
            onChange={(event) => props.onFilter(event.target.value)}
          />
        </div>

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
          aria-expanded={identityOpen}
          aria-controls="topbar-identity"
          onClick={() => setIdentityOpen((open) => !open)}
        >
          <span className="small muted">Acting as</span>
          <span className="topbar-identity-value">{identitySummary}</span>
          <span className="topbar-identity-caret" aria-hidden="true">
            {identityOpen ? "▴" : "▾"}
          </span>
        </button>

        <div
          id="topbar-identity"
          className={identityOpen ? "topbar-identity open" : "topbar-identity"}
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
              {sessionsForActor.map((session) => (
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
        </div>
      </div>

      <div className="topbar-actions">
        <div className="topbar-broadcast">
          <button
            ref={props.broadcastRef}
            disabled={Boolean(props.broadcastDisabledReason)}
            aria-describedby={
              props.broadcastDisabledReason ? "broadcast-reason" : undefined
            }
            onClick={props.onBroadcast}
          >
            Broadcast to team
          </button>
          {props.broadcastDisabledReason ? (
            <p id="broadcast-reason" className="small muted broadcast-reason">
              {props.broadcastDisabledReason}
            </p>
          ) : null}
        </div>

        <div className="topbar-refresh">
          <button onClick={props.onRefresh} disabled={props.busy}>
            {props.busy ? "Refreshing…" : "Refresh"}
          </button>
          <span className="small muted">
            {props.lastUpdated
              ? `Updated ${relativeTime(props.lastUpdated.toISOString())}`
              : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
