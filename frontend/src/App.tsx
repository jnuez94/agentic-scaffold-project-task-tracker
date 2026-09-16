/**
 * The application shell: navigation, identity, and the routed view.
 */

import { useRef, useState } from "react";
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
import { RoutedView } from "./views/RoutedView.tsx";
import { EndSessionControl } from "./views/EndSessionControl.tsx";
import { useThemePreference } from "./state/useThemePreference.ts";
import { useRouteEntryScroll } from "./state/useRouteEntryScroll.ts";
import { useAgentsAfterBootstrap } from "./state/useAgentsAfterBootstrap.ts";
import { useLayout } from "./state/useLayout.ts";
import { useBroadcastLauncher } from "./state/useBroadcastLauncher.ts";
import { useInbox } from "./state/useInbox.ts";
import { unreadChip } from "./lib/inbox.ts";
import { useMeasuredHeight } from "./state/useMeasuredHeight.ts";
import { useResource } from "./state/useResource.ts";
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

  const [theme, setTheme] = useThemePreference();
  useRouteEntryScroll(contentRef, route.name);

  const meta = useResource(() => coordination.meta(), []);
  const agents = useResource(
    () => coordination.agents({ all: "1", limit: 500 }),
    [],
  );

  useAgentsAfterBootstrap(bootstrap.kind, agents.refresh);

  const agentList = agents.data ?? [];
  const actor = agentList.find((agent) => agent.id === identity.actorId);
  const broadcast = useBroadcastLauncher(
    actor,
    session.activeSessionId,
    mutationsEnabled,
  );

  // The acting actor's inbox (UI-68): loaded here so the nav can carry its
  // count and the Messages route can show it without a second request.
  const inbox = useInbox(coordination, identity.actorId, broadcast.sentNonce);

  const refreshAll = () => {
    meta.refresh();
    agents.refresh();
    session.refresh();
    inbox.resource.refresh();
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
      {/* One boundary for everything behind the dialog.
       *
       * `aria-modal="true"` claims the rest of the page is unavailable, and
       * marking only the content region inert left the navigation, toolbar,
       * resize handle, and footer reachable — the claim was false, and a
       * keyboard operator mid-draft could land on a route link.
       *
       * `display: contents` so this wrapper adds a boundary without adding a
       * box: nav, handle, and main stay direct participants in the shell grid.
       * `inert` still applies to the whole subtree. */}
      <div className="shell-background" inert={broadcast.open}>
        <NavSidebar
          active={route.name}
          meta={meta.data}
          theme={theme}
          onTheme={setTheme}
          badges={{ messages: unreadChip(inbox.reading) }}
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
            sessionControls={
              session.activeSessionId ? (
                <EndSessionControl
                  sessionId={session.activeSessionId}
                  onEnded={() => {
                    // The persisted selection must not outlive the session it
                    // names — a stale id is the clean-launch bug UI-14 fixed.
                    setSession(null);
                    session.refresh();
                  }}
                />
              ) : null
            }
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
              {
                "--scrollport-height": `${scrollportHeight}px`,
              } as CSSProperties
            }
          >
            <StartupBanner phase={bootstrap} onRetry={retryBootstrap} />

            {meta.error ? (
              <ErrorBanner error={meta.error} onRetry={meta.refresh} />
            ) : null}

            <RoutedView
              route={route}
              navigate={navigate}
              filter={filter}
              agents={agentList}
              layout={layout}
              broadcastNonce={broadcast.sentNonce}
              inbox={inbox}
            />
          </main>

          <footer className="statusbar small">
            <DatabaseIdentity path={meta.data?.database} onCopied={announce} />
            <span className="muted statusbar-note">
              Local only · loopback · every write goes through the coordination
              CLI
            </span>
          </footer>
        </div>
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
