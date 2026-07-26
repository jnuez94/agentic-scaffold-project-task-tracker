/**
 * The application shell: navigation, identity, and the routed view.
 */

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ErrorBanner, LiveRegion } from "./components/Feedback.tsx";
import { DatabaseIdentity } from "./components/DatabaseIdentity.tsx";
import { NavSidebar } from "./components/NavSidebar.tsx";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.tsx";
import { StartupBanner } from "./components/StartupBanner.tsx";
import { BroadcastComposer } from "./views/BroadcastComposer.tsx";
import { ResizeHandle } from "./components/ResizeHandle.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { useApp } from "./state/AppContext.tsx";
import { BOUNDS } from "./state/layoutStore.ts";
import { useHashRoute } from "./state/useHashRoute.ts";
import { useLayout } from "./state/useLayout.ts";
import { useBroadcastLauncher } from "./state/useBroadcastLauncher.ts";
import { useMeasuredHeight } from "./state/useMeasuredHeight.ts";
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

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollportHeight = useMeasuredHeight(contentRef);

  const meta = useResource(() => coordination.meta(), []);
  const agents = useResource(
    () => coordination.agents({ all: "1", limit: 500 }),
    [],
  );

  const agentList = agents.data ?? [];
  const actor = agentList.find((agent) => agent.id === identity.actorId);
  const broadcast = useBroadcastLauncher(
    actor,
    session.activeSessionId,
    mutationsEnabled,
  );

  const refreshAll = () => {
    meta.refresh();
    agents.refresh();
    session.refresh();
  };

  const placeholder =
    route.name === "tasks"
      ? "Filter loaded tasks by id, title, owner, or tag…"
      : (RECORD_CONFIGS[route.name]?.filterPlaceholder ??
        "Filter loaded rows…");

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

        {/* The scrollport's own height, published for the sticky inspectors.
            They must not grow past what is visible, and neither `100%` nor
            `100vh` says that: `100%` resolves against the scrolling content,
            which is far taller, and `100vh` counts chrome this region does not
            occupy. Measuring is the only expression of "as tall as what the
            operator can actually see". */}
        <main
          className="content"
          id="content"
          ref={contentRef}
          style={
            { "--scrollport-height": `${scrollportHeight}px` } as CSSProperties
          }
          inert={broadcast.open}
        >
          <StartupBanner phase={bootstrap} onRetry={retryBootstrap} />

          {meta.error ? (
            <ErrorBanner error={meta.error} onRetry={meta.refresh} />
          ) : null}

          {/* Scoped to the routed surface only, so a view that fails to render
              costs the operator that view and not the navigation, the identity
              controls, or their bearings. Navigating away clears it. */}
          <RouteErrorBoundary resetKey={route.name}>
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
              <MessagesView
                filter={filter}
                agents={agentList}
                layout={layout}
                reloadKey={broadcast.sentNonce}
              />
            ) : RECORD_CONFIGS[route.name] ? (
              /* Keyed by route, and that key is the whole fix for a stop-ship
               crash. Every generic entity shares this one component position,
               so React reused the instance across routes: useResource keeps the
               previous rows while the next request is in flight, which is right
               for a refresh of the same resource and badly wrong across a route
               change. Decision rows reached the Artifacts columns, which read a
               field decisions do not have, and the whole console unmounted.

               The key makes the route part of the component's identity, so a
               different route is a different component: fresh resource, and
               with it fresh status filter, sort, pagination, and selection.
               None of those belong to the route the operator just left. */
              <RecordsView
                key={route.name}
                route={route.name}
                filter={filter}
              />
            ) : null}
          </RouteErrorBoundary>
        </main>

        <footer className="statusbar small">
          <DatabaseIdentity path={meta.data?.database} onCopied={announce} />
          <span className="muted statusbar-note">
            Local only · loopback · every write goes through the coordination
            CLI
          </span>
        </footer>
      </div>

      {broadcast.open &&
      broadcast.readiness.kind === "ready" &&
      session.activeSessionId ? (
        <>
          <div
            className="sheet-scrim"
            onClick={broadcast.onClose}
            aria-hidden="true"
          />
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
