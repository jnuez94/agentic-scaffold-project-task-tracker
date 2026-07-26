/**
 * Generic entity browser driven by RECORD_CONFIGS.
 */

import { useMemo, useState } from "react";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { filterRows } from "../lib/filters.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import type { RouteName } from "../state/useHashRoute.ts";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";

const REQUEST_LIMIT = 500;

export function RecordsView<T = Record<string, unknown>>({
  route,
  filter,
  reloadKey = 0,
  onSelect,
  selectedKey,
}: {
  route: RouteName;
  filter: string;
  /** Bumped by a caller to force a refetch, e.g. after sending a broadcast. */
  reloadKey?: number;
  /** Receives the already-loaded row, so a detail view needs no extra query. */
  onSelect?: (row: T) => void;
  selectedKey?: string | null;
}) {
  const { coordination } = useApp();
  const config = RECORD_CONFIGS[route];
  const [statusValue, setStatusValue] = useState("");

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

  const rows = useMemo(
    () => filterRows((records.data ?? []) as Record<string, unknown>[], config?.filterFields ?? [], filter),
    [records.data, config, filter],
  );

  if (!config) return null;

  return (
    <section className="records" aria-label={config.title}>
      <div className="view-header">
        <h1>{config.title}</h1>
        <p className="small muted">{config.description}</p>
      </div>

      <div className="queue-toolbar">
        {config.statusOptions ? (
          <div className="control">
            <label htmlFor="record-status">{config.statusOptions.label}</label>
            <select
              id="record-status"
              value={statusValue}
              onChange={(event) => setStatusValue(event.target.value)}
            >
              <option value="">All</option>
              {config.statusOptions.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {records.error ? <ErrorBanner error={records.error} onRetry={records.refresh} /> : null}

      <DataTable
        rows={rows as never[]}
        columns={config.columns}
        rowKey={(row) => String((row as Record<string, unknown>)["id"])}
        caption={config.title}
        defaultOrder={config.defaultOrder}
        idPrefix={route}
        filtered={Boolean(filter)}
        truncated={isTruncated(((records.data ?? []) as unknown[]).length, REQUEST_LIMIT)}
        loading={records.loading}
        loaded={records.loaded}
        selectedKey={selectedKey ?? null}
        onSelect={onSelect ? (row) => onSelect(row as T) : undefined}
        emptyTitle={filter ? `No ${config.title.toLowerCase()} match this filter` : config.emptyTitle}
        emptyHint={filter ? "Clear the filter to see everything loaded." : config.emptyHint}
      />
    </section>
  );
}
