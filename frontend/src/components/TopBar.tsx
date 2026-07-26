/**
 * Top bar: filter box, identity selection, and refresh.
 *
 * The search box is labelled "Filter loaded rows" rather than "Search",
 * because the CLI has no cross-entity search and no tag filter. Calling it
 * search would imply it covers records that are not on screen.
 */

import type { Agent, Session } from "../api/contract.ts";
import { relativeTime } from "../lib/format.ts";

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
}

export function TopBar(props: TopBarProps) {
  const sessionsForActor = props.sessions.filter(
    (session) => session.status === "active" && session.agent_id === props.actorId,
  );

  return (
    <header className="topbar">
      <div className="topbar-filter">
        <label htmlFor="row-filter" className="visually-hidden">
          Filter loaded rows
        </label>
        <span className="topbar-glyph" aria-hidden="true">
          ⌕
        </span>
        <input
          id="row-filter"
          type="search"
          value={props.filter}
          placeholder={props.filterPlaceholder}
          onChange={(event) => props.onFilter(event.target.value)}
        />
      </div>

      <div className="topbar-identity">
        <div className="control">
          <label htmlFor="actor-select">Acting as</label>
          <select
            id="actor-select"
            value={props.actorId ?? ""}
            onChange={(event) => props.onActor(event.target.value || null)}
          >
            <option value="">No actor selected</option>
            {props.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.id}
              </option>
            ))}
          </select>
        </div>

        <div className="control">
          <label htmlFor="session-select">Active session</label>
          <select
            id="session-select"
            value={props.sessionId ?? ""}
            onChange={(event) => props.onSession(event.target.value || null)}
            disabled={!props.actorId}
          >
            <option value="">No session</option>
            {sessionsForActor.map((session) => (
              <option key={session.id} value={session.id}>
                {session.id} · {session.harness}
              </option>
            ))}
          </select>
        </div>

        <div className="topbar-refresh">
          <button onClick={props.onRefresh} disabled={props.busy}>
            {props.busy ? "Refreshing…" : "Refresh"}
          </button>
          <span className="small muted">
            {props.lastUpdated ? `Updated ${relativeTime(props.lastUpdated.toISOString())}` : "—"}
          </span>
        </div>
      </div>
    </header>
  );
}
