/**
 * Left navigation: destinations, connection posture, and current identity.
 */

import type { Meta } from "../api/contract.ts";
import { Icon, type IconName } from "./icons.tsx";
import { buildHash, type RouteName } from "../state/useHashRoute.ts";
import { THEMES, THEME_LABELS, type Theme } from "../state/themePreference.ts";

interface Group {
  title: string;
  items: { route: RouteName; label: string; icon: IconName }[];
}

const GROUPS: Group[] = [
  {
    title: "Work",
    items: [
      { route: "tasks", label: "Tasks", icon: "tasks" },
      { route: "reviews", label: "Reviews", icon: "reviews" },
      { route: "messages", label: "Messages", icon: "messages" },
    ],
  },
  {
    title: "People",
    items: [
      { route: "agents", label: "Agents", icon: "agents" },
      { route: "sessions", label: "Sessions", icon: "sessions" },
    ],
  },
  {
    title: "Governance",
    items: [
      { route: "decisions", label: "Decisions", icon: "decisions" },
      { route: "artifacts", label: "Artifacts", icon: "artifacts" },
      { route: "escalations", label: "Escalations", icon: "escalations" },
    ],
  },
  {
    title: "System",
    items: [
      { route: "health", label: "Health", icon: "health" },
      { route: "audit", label: "Audit log", icon: "audit" },
      { route: "export", label: "Export", icon: "export" },
    ],
  },
];

export function NavSidebar({
  active,
  meta,
  actorLabel,
  sessionLabel,
  theme,
  onTheme,
}: {
  active: RouteName;
  meta: Meta | undefined;
  actorLabel: string;
  sessionLabel: string;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav-brand">
        <span className="nav-mark">
          <Icon name="brand" size={22} />
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
          {/* A div, not an h2. These label navigation groups; they are not
              document structure, and as headings they preceded the page's only
              h1 in DOM order — an outline of h2, h2, h2, h2, h1. The grouping
              semantics that actually matter are preserved by pointing each
              list at its label with aria-labelledby. */}
          <div className="nav-group-title" id={groupLabelId(group.title)}>
            {group.title}
          </div>
          <ul aria-labelledby={groupLabelId(group.title)}>
            {group.items.map((item) => (
              <li key={item.route}>
                <a
                  href={buildHash(item.route)}
                  className={item.route === active ? "nav-link active" : "nav-link"}
                  aria-current={item.route === active ? "page" : undefined}
                >
                  <span className="nav-glyph">
                    <Icon name={item.icon} />
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
        {/* A display preference, not coordination state: it is stored locally,
            never attributed to an actor, and never written to the database. It
            sits beside "Local only" rather than in the top bar because the top
            bar is where accountable identity lives, and a theme is not that. */}
        <div className="nav-card">
          <label className="nav-card-title" htmlFor="theme-select">
            Theme
          </label>
          <select
            id="theme-select"
            className="nav-theme-select"
            value={theme}
            onChange={(event) => onTheme(event.target.value as Theme)}
          >
            {THEMES.map((value) => (
              <option key={value} value={value}>
                {THEME_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}

/** Stable id linking a nav group's list to its visible label. */
function groupLabelId(title: string): string {
  return `nav-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
