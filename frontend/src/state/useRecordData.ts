/**
 * The data a record route needs: its own rows, plus the side lists its
 * inspector panels depend on.
 *
 * Extracted from RecordsView so that view stays within the file-size limit and
 * keeps to rendering. The side lists are loaded only for the routes that use
 * them — tasks for the panels that must name outstanding work, sessions for the
 * Agents inspector explaining the CLI's active-session guard — because a route
 * should not pay for a panel it never shows.
 */

import { useMemo } from "react";
import type { Coordination } from "../api/coordination.ts";
import type { RouteName } from "./useHashRoute.ts";
import { useResource } from "./useResource.ts";
import type { RecordConfig } from "../views/recordConfigs.tsx";

const REQUEST_LIMIT = 500;

export function useRecordData(
  coordination: Coordination,
  route: RouteName,
  config: RecordConfig | undefined,
  statusValue: string,
  reloadKey: number,
) {
  const statusParam = config?.statusOptions?.param;
  const query = useMemo(() => {
    const built: Record<string, string> = { limit: String(REQUEST_LIMIT) };
    if (statusParam && statusValue) built[statusParam] = statusValue;
    return built;
  }, [statusParam, statusValue]);

  const records = useResource(
    () => (config ? config.load(coordination, query) : Promise.resolve([])),
    [route, query, reloadKey],
    { enabled: Boolean(config) },
  );

  const needsTasks = Boolean(config?.rowAction) || route === "agents";
  const tasks = useResource(
    () => (needsTasks ? coordination.tasks({ limit: REQUEST_LIMIT }) : Promise.resolve([])),
    [coordination, route],
    { enabled: needsTasks },
  );

  const sessions = useResource(
    () =>
      route === "agents"
        ? coordination.sessions({ limit: REQUEST_LIMIT })
        : Promise.resolve([]),
    [coordination, route],
    { enabled: route === "agents" },
  );

  return { records, tasks, sessions, requestLimit: REQUEST_LIMIT };
}
