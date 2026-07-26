/**
 * The application shell: navigation, identity, and the routed view.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ErrorBanner, LiveRegion } from "./components/Feedback.tsx";
import { DatabaseIdentity } from "./components/DatabaseIdentity.tsx";
import { NavSidebar } from "./components/NavSidebar.tsx";
import { StartupBanner } from "./components/StartupBanner.tsx";
import { ResizeHandle } from "./components/ResizeHandle.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { useApp } from "./state/AppContext.tsx";
import { BOUNDS } from "./state/layoutStore.ts";
import { useHashRoute } from "./state/useHashRoute.ts";
import { useLayout } from "./state/useLayout.ts";
import { useResource } from "./state/useResource.ts";
import { AuditView } from "./views/AuditView.tsx";
import { ExportView } from "./views/ExportView.tsx";
import { HealthView } from "./views/HealthView.tsx";
import { MessagesView } from "./views/MessagesView.tsx";
import { RecordsView } from "./views/RecordsView.tsx";
import { TasksView } from "./views/TasksView.tsx";
import { RECORD_CONFIGS } from "./views/recordConfigs.tsx";

export function App() {
  const {
    coordination,
    identity,
    setActor,
    setSession,
    announcement,
    announce,
    bootstrap,
    retryBootstrap,
  } = useApp();
  const { route, navigate } = useHashRoute();
  const { widths, setWidth, reset } = useLayout();
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
    <div
      className="shell"
      style={{ "--nav-width": `${widths.nav}px` } as CSSProperties}
    >
      <NavSidebar
        active={route.name}
        meta={meta.data}
        actorLabel={actor ? `${actor.name} · ${actor.id}` : "No actor selected"}
        sessionLabel={identity.sessionId ? `Session ${identity.sessionId}` : "No active session"}
      />

      <ResizeHandle
        label="Resize navigation"
        value={widths.nav}
        min={BOUNDS.nav.min}
        max={BOUNDS.nav.max}
        direction={1}
        onResize={(next) => setWidth("nav", next)}
        onReset={() => reset("nav")}
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
          <StartupBanner phase={bootstrap} onRetry={retryBootstrap} />

          {meta.error ? <ErrorBanner error={meta.error} onRetry={meta.refresh} /> : null}

          {route.name === "tasks" ? (
            <TasksView
              filter={filter}
              agents={agentList}
              selectedId={route.detail}
              onSelect={(id) => navigate("tasks", id)}
              inspectorWidth={widths.inspector}
              onInspectorResize={(next) => setWidth("inspector", next)}
              onInspectorReset={() => reset("inspector")}
            />
          ) : null}

          {route.name === "health" ? <HealthView /> : null}
          {route.name === "audit" ? <AuditView filter={filter} /> : null}
          {route.name === "export" ? <ExportView /> : null}

          {route.name === "messages" ? (
            <MessagesView filter={filter} agents={agentList} />
          ) : RECORD_CONFIGS[route.name] ? (
            <RecordsView route={route.name} filter={filter} />
          ) : null}
        </main>

        <footer className="statusbar small">
          <DatabaseIdentity path={meta.data?.database} onCopied={announce} />
          <span className="muted">
            Local only · loopback · every write goes through the coordination CLI
          </span>
        </footer>
      </div>

      <LiveRegion message={announcement} />
    </div>
  );
}
