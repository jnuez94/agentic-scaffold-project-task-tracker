/**
 * The view for the current route, and the boundary around it.
 *
 * Split from App because the two are different jobs: App assembles the shell —
 * navigation, toolbar, footer, global broadcast — while this answers "which
 * view, given the route". The props are not drilling; they are the inputs the
 * views need, and App is where they are assembled.
 *
 * The error boundary comes with it rather than staying behind. It is scoped to
 * the routed surface on purpose, so a view that fails to render costs the
 * operator that view and not the navigation, the identity controls, or their
 * bearings — and a boundary separated from what it guards is one someone will
 * later widen without noticing what it was protecting.
 */

import { RouteErrorBoundary } from "../components/RouteErrorBoundary.tsx";
import type { Agent } from "../api/contract.ts";
import type { InboxState } from "../state/useInbox.ts";
import type { Layout } from "../state/useLayout.ts";
import type { Route, RouteName } from "../state/useHashRoute.ts";
import { AuditView } from "./AuditView.tsx";
import { ExportView } from "./ExportView.tsx";
import { HealthView } from "./HealthView.tsx";
import { MessagesView } from "./MessagesView.tsx";
import { RecordsView } from "./RecordsView.tsx";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";
import { TasksView } from "./TasksView.tsx";

export function RoutedView({
  route,
  navigate,
  filter,
  agents,
  layout,
  broadcastNonce,
  inbox,
}: {
  route: Route;
  navigate: (name: RouteName, detail?: string | null) => void;
  filter: string;
  agents: Agent[];
  layout: Layout;
  /** Bumped after a successful broadcast, so Messages reloads. */
  broadcastNonce: number;
  inbox: InboxState;
}) {
  return (
    <RouteErrorBoundary resetKey={route.name}>
      {route.name === "tasks" ? (
        <TasksView
          filter={filter}
          agents={agents}
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
          agents={agents}
          layout={layout}
          reloadKey={broadcastNonce}
          inbox={inbox}
        />
      ) : RECORD_CONFIGS[route.name] ? (
        /* Keyed by route, and that key is the whole fix for a stop-ship crash.
           Every generic entity shares this one component position, so React
           reused the instance across routes: useResource keeps the previous
           rows while the next request is in flight, which is right for a
           refresh of the same resource and badly wrong across a route change.
           Decision rows reached the Artifacts columns, which read a field
           decisions do not have, and the whole console unmounted.

           The key makes the route part of the component's identity, so a
           different route is a different component: fresh resource, and with it
           fresh status filter, sort, pagination, and selection. None of those
           belong to the route the operator just left. */
        <RecordsView key={route.name} route={route.name} filter={filter} />
      ) : null}
    </RouteErrorBoundary>
  );
}
