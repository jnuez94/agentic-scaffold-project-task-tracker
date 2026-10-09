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
import { Icon } from "./icons.tsx";
import { IdentityPopover } from "./IdentityPopover.tsx";

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
  broadcastDisabledReason: string | null;
  onBroadcast: () => void;
  /**
   * Rendered inside the identity popover, after the selects (UI-51). A slot
   * rather than an import so this component stays presentational — App
   * decides what session controls exist. Mounted only while the identity
   * surface is actually open, so anything the slot fetches is paid on open.
   */
  sessionControls?: React.ReactNode;
  /** The current route, hash and all; the identity popover closes when it changes. */
  routeKey: string;
}

export function TopBar(props: TopBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  // Any route change closes the popover (UI-77): it covers page content, and
  // left open it stays over a page the operator did not open it on.
  const [routeSeen, setRouteSeen] = useState(props.routeKey);
  if (routeSeen !== props.routeKey) {
    setRouteSeen(props.routeKey);
    setIdentityOpen(false);
  }

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

        <IdentityPopover
          open={identityOpen}
          onToggle={() => setIdentityOpen((open) => !open)}
          onClose={() => setIdentityOpen(false)}
          summary={identitySummary}
          agents={props.agents}
          sessions={props.sessions}
          actorId={props.actorId}
          sessionId={props.sessionId}
          onActor={props.onActor}
          onSession={props.onSession}
          sessionReason={props.sessionReason}
          inline={panelOpen}
          sessionControls={props.sessionControls}
        />
      </div>

      <div className="topbar-actions">
        <div className="topbar-broadcast">
          <button
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
