/**
 * The data a record route needs: its own rows, plus the side lists its
 * inspector panels depend on.
 *
 * Extracted from RecordsView so that view stays within the file-size limit and
 * keeps to rendering. The side lists are loaded only for the routes that use
 * them — tasks for the panels that must name outstanding work or check a
 * resolution's follow-ups, sessions for the
 * Agents inspector explaining the CLI's active-session guard — because a route
 * should not pay for a panel it never shows.
 */

import { useMemo } from "react";
import type { Coordination } from "../api/coordination.ts";
import { readMarked } from "../lib/auditWatermark.ts";
import { activeSessions, NEWEST_FIRST, openTasks } from "../lib/listQueries.ts";
import type { RouteName } from "./useHashRoute.ts";
import { useListWindow } from "./useListWindow.ts";
import { useResource } from "./useResource.ts";
import type { RecordConfig } from "../views/recordConfigs.tsx";

/** Sessions have no created_at; they start. Every other list is newest by creation. */
const NEWEST: Partial<Record<RouteName, string>> = { sessions: "started_at:desc" };

export function useRecordData(
  coordination: Coordination,
  route: RouteName,
  config: RecordConfig | undefined,
  where: readonly string[],
  reloadKey: number,
  orderBy?: string,
) {
  // Compared by value: the same clauses in a new array are the same request.
  const whereKey = where.join("\u0000");
  const query = useMemo(() => {
    const built: Record<string, string | string[]> = {};
    if (where.length > 0) built["where"] = [...where];
    // Newest first unless the operator sorted (UI-86): the CLI's own order is
    // oldest first, so a busy project's newest rows never loaded.
    built["order_by"] = orderBy ?? NEWEST[route] ?? NEWEST_FIRST;
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whereKey, orderBy, route]);

  const records = useListWindow<Record<string, unknown>>(
    (page) =>
      config
        ? // Each page is marked with the audit head read before it (UI-88).
          readMarked(
            coordination,
            () =>
              config.load(coordination, { ...query, limit: String(page.limit), offset: String(page.offset) }) as Promise<
                Record<string, unknown>[]
              >,
          )
        : Promise.resolve([]),
    (row) => String(row["id"]),
    [route, query, reloadKey],
    { enabled: Boolean(config) },
  );

  // Escalations need them to check a resolution's follow-up tasks (UI-82).
  // Only open tasks: claims, assignments and follow-up work are never done.
  const needsTasks = Boolean(config?.rowAction) || route === "agents" || route === "escalations";
  const tasks = useResource(
    () => (needsTasks ? openTasks(coordination) : Promise.resolve([])),
    [coordination, route],
    { enabled: needsTasks },
  );

  // The Agents inspector explains the CLI's active-session guard, so only
  // active sessions matter.
  const sessions = useResource(
    () => (route === "agents" ? activeSessions(coordination) : Promise.resolve([])),
    [coordination, route],
    { enabled: route === "agents" },
  );

  return { records, tasks, sessions };
}
