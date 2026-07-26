/**
 * Left navigation: destinations, connection posture, and current identity.
 */

import type { Meta } from "../api/contract.ts";
import { buildHash, type RouteName } from "../state/useHashRoute.ts";

interface Group {
  title: string;
  items: { route: RouteName; label: string; glyph: string }[];
}

const GROUPS: Group[] = [
  {
    title: "Work",
    items: [
      { route: "tasks", label: "Tasks", glyph: "☰" },
      { route: "reviews", label: "Reviews", glyph: "★" },
      { route: "messages", label: "Messages", glyph: "✉" },
    ],
  },
  {
    title: "People",
    items: [
      { route: "agents", label: "Agents", glyph: "◍" },
      { route: "sessions", label: "Sessions", glyph: "▤" },
    ],
  },
  {
    title: "Governance",
    items: [
      { route: "decisions", label: "Decisions", glyph: "⚖" },
      { route: "artifacts", label: "Artifacts", glyph: "🗎" },
      { route: "escalations", label: "Escalations", glyph: "⚠" },
    ],
  },
  {
    title: "System",
    items: [
      { route: "health", label: "Health", glyph: "✚" },
      { route: "audit", label: "Audit log", glyph: "⧗" },
      { route: "export", label: "Export", glyph: "⤓" },
    ],
  },
];

export function NavSidebar({
  active,
  meta,
  actorLabel,
  sessionLabel,
}: {
  active: RouteName;
  meta: Meta | undefined;
  actorLabel: string;
  sessionLabel: string;
}) {
  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav-brand">
        <span className="nav-mark" aria-hidden="true">
          ◆
        </span>
        <span>
          <span className="nav-product">Agentic Project Scaffold Lite</span>
          <span className="nav-sub mono">
            {meta ? `CLI v${meta.cli_version} · schema v${meta.schema_version}` : "connecting…"}
          </span>
        </span>
      </div>

      {GROUPS.map((group) => (
        <div className="nav-group" key={group.title}>
          <h2 className="nav-group-title">{group.title}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.route}>
                <a
                  href={buildHash(item.route)}
                  className={item.route === active ? "nav-link active" : "nav-link"}
                  aria-current={item.route === active ? "page" : undefined}
                >
                  <span className="nav-glyph" aria-hidden="true">
                    {item.glyph}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="nav-footer">
        <div className="nav-card">
          <div className="nav-card-title">
            <span className="dot dot-mint" aria-hidden="true" /> Local only
          </div>
          <p className="small muted">
            SQLite via the coordination CLI. Nothing leaves this machine.
          </p>
        </div>
        <div className="nav-card">
          <div className="nav-card-title">Operating as</div>
          <div className="nav-identity mono">{actorLabel}</div>
          <div className="small muted">{sessionLabel}</div>
        </div>
      </div>
    </nav>
  );
}
