/**
 * The application shell: navigation, identity, and the routed view.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ErrorBanner, LiveRegion } from "./components/Feedback.tsx";
import { DatabaseIdentity } from "./components/DatabaseIdentity.tsx";
import { NavSidebar } from "./components/NavSidebar.tsx";
import { StartupBanner } from "./components/StartupBanner.tsx";
import { BroadcastComposer } from "./views/BroadcastComposer.tsx";
import { ResizeHandle } from "./components/ResizeHandle.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { useApp } from "./state/AppContext.tsx";
import { BOUNDS } from "./state/layoutStore.ts";
import { useHashRoute } from "./state/useHashRoute.ts";
import { useLayout } from "./state/useLayout.ts";
import { useBroadcastLauncher } from "./state/useBroadcastLauncher.ts";
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
    session,
    mutationsEnabled,
  } = useApp();
  const { route, navigate } = useHashRoute();
  // One instance only: a second useLayout would persist to the same key from
  // stale state and clobber the first.
  const layout = useLayout();
  const { widths, setWidth, reset } = layout;
  const [filter, setFilter] = useState("");

  const meta = useResource(() => coordination.meta(), []);
  const agents = useResource(() => coordination.agents({ all: "1", limit: 500 }), []);

  const agentList = agents.data ?? [];
  const actor = agentList.find((agent) => agent.id === identity.actorId);
  const broadcast = useBroadcastLauncher(actor, session.activeSessionId, mutationsEnabled);

  const refreshAll = () => {
    meta.refresh();
    agents.refresh();
    session.refresh();
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
        sessionLabel={
          session.activeSessionId
            ? `Session ${session.activeSessionId}`
            : "No active session"
        }
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
          sessions={session.selectable}
          actorId={identity.actorId}
          sessionId={session.activeSessionId}
          sessionReason={session.reason}
          onActor={setActor}
          onSession={setSession}
          onRefresh={refreshAll}
          broadcastRef={broadcast.triggerRef}
          broadcastDisabledReason={broadcast.disabledReason}
          onBroadcast={broadcast.onOpen}
          lastUpdated={agents.lastUpdated}
          busy={agents.loading || session.loading}
        />

        <main className="content" id="content" inert={broadcast.open}>
          <StartupBanner phase={bootstrap} onRetry={retryBootstrap} />

          {meta.error ? <ErrorBanner error={meta.error} onRetry={meta.refresh} /> : null}

          {route.name === "tasks" ? (
            <TasksView
              filter={filter}
              agents={agentList}
              selectedId={route.detail}
              onSelect={(id) => navigate("tasks", id)}
              layout={layout}
            />
          ) : null}

          {route.name === "health" ? <HealthView /> : null}
          {route.name === "audit" ? <AuditView filter={filter} /> : null}
          {route.name === "export" ? <ExportView /> : null}

          {route.name === "messages" ? (
            <MessagesView filter={filter} layout={layout} reloadKey={broadcast.sentNonce} />
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

      {broadcast.open && broadcast.readiness.kind === "ready" && session.activeSessionId ? (
        <>
          <div className="sheet-scrim" onClick={broadcast.onClose} aria-hidden="true" />
          <BroadcastComposer
            senderId={broadcast.readiness.senderId}
            senderName={actor?.name ?? broadcast.readiness.senderId}
            sessionId={session.activeSessionId}
            onClose={broadcast.onClose}
            onSent={broadcast.onSent}
          />
        </>
      ) : null}

      <LiveRegion message={announcement} />
    </div>
  );
}
