/**
 * The application shell: navigation, identity, and the routed view.
 */

import { useState } from "react";
import { ErrorBanner, LiveRegion } from "./components/Feedback.tsx";
import { NavSidebar } from "./components/NavSidebar.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { useApp } from "./state/AppContext.tsx";
import { useHashRoute } from "./state/useHashRoute.ts";
import { useResource } from "./state/useResource.ts";
import { AuditView } from "./views/AuditView.tsx";
import { ExportView } from "./views/ExportView.tsx";
import { HealthView } from "./views/HealthView.tsx";
import { RecordsView } from "./views/RecordsView.tsx";
import { TasksView } from "./views/TasksView.tsx";
import { RECORD_CONFIGS } from "./views/recordConfigs.tsx";

export function App() {
  const { coordination, identity, setActor, setSession, announcement } = useApp();
  const { route, navigate } = useHashRoute();
  const [filter, setFilter] = useState("");

  const meta = useResource(() => coordination.meta(), []);
  const agents = useResource(() => coordination.agents({ all: "1", limit: 500 }), []);
  const sessions = useResource(() => coordination.sessions({ limit: 500 }), []);

  const agentList = agents.data ?? [];
  const actor = agentList.find((agent) => agent.id === identity.actorId);

  const refreshAll = () => {
    meta.refresh();
    agents.refresh();
    sessions.refresh();
  };

  const placeholder =
    route.name === "tasks"
      ? "Filter loaded tasks by id, title, owner, or tag…"
      : (RECORD_CONFIGS[route.name]?.filterPlaceholder ?? "Filter loaded rows…");

  return (
    <div className="shell">
      <NavSidebar
        active={route.name}
        meta={meta.data}
        actorLabel={actor ? `${actor.name} · ${actor.id}` : "No actor selected"}
        sessionLabel={identity.sessionId ? `Session ${identity.sessionId}` : "No active session"}
      />

      <div className="main">
        <TopBar
          filter={filter}
          onFilter={setFilter}
          filterPlaceholder={placeholder}
          agents={agentList}
          sessions={sessions.data ?? []}
          actorId={identity.actorId}
          sessionId={identity.sessionId}
          onActor={setActor}
          onSession={setSession}
          onRefresh={refreshAll}
          lastUpdated={agents.lastUpdated}
          busy={agents.loading || sessions.loading}
        />

        <main className="content" id="content">
          {meta.error ? <ErrorBanner error={meta.error} onRetry={meta.refresh} /> : null}

          {route.name === "tasks" ? (
            <TasksView
              filter={filter}
              agents={agentList}
              selectedId={route.detail}
              onSelect={(id) => navigate("tasks", id)}
            />
          ) : null}

          {route.name === "health" ? <HealthView /> : null}
          {route.name === "audit" ? <AuditView filter={filter} /> : null}
          {route.name === "export" ? <ExportView /> : null}

          {RECORD_CONFIGS[route.name] ? (
            <RecordsView route={route.name} filter={filter} />
          ) : null}
        </main>

        <footer className="statusbar small">
          <span className="mono">{meta.data?.database ?? "resolving database…"}</span>
          <span className="muted">
            Local only · loopback · every write goes through the coordination CLI
          </span>
        </footer>
      </div>

      <LiveRegion message={announcement} />
    </div>
  );
}
