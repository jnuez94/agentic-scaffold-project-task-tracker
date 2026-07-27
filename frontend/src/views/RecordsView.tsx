/**
 * Generic entity browser driven by RECORD_CONFIGS.
 */

import { useMemo, useRef, useState } from "react";
import type { Session, TaskListRow } from "../api/contract.ts";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { filterRows } from "../lib/filters.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import type { RouteName } from "../state/useHashRoute.ts";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";
import { SessionRecovery } from "./SessionRecovery.tsx";

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
  const { coordination, identity } = useApp();
  const config = RECORD_CONFIGS[route];
  const [statusValue, setStatusValue] = useState("");
  const [acting, setActing] = useState<Record<string, unknown> | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);

  // Only fetched for routes that declare a row action needing it; the recovery
  // dialog names the tasks it will block rather than describing them vaguely.
  const claimable = useResource(
    () =>
      config?.rowAction
        ? coordination.tasks({ limit: 500 })
        : Promise.resolve([]),
    [coordination, route],
    { enabled: Boolean(config?.rowAction) },
  );

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

  const tableColumns = useMemo(() => {
    if (!config?.rowAction) return config?.columns ?? [];
    const action = config.rowAction;
    return [
      ...config.columns,
      {
        key: "__action",
        header: action.header,
        priority: 1,
        render: (row: Record<string, unknown>) =>
          action.applies(row) ? (
            <button
              type="button"
              className="link-button"
              onClick={(event) => {
                event.stopPropagation();
                launcher.current = event.currentTarget;
                setActing(row);
              }}
            >
              {action.label}
            </button>
          ) : (
            <span className="small muted">—</span>
          ),
      } as never,
    ];
  }, [config]);

  const rows = useMemo(
    () =>
      filterRows(
        (records.data ?? []) as Record<string, unknown>[],
        config?.filterFields ?? [],
        filter,
      ),
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

      {records.error ? (
        <ErrorBanner error={records.error} onRetry={records.refresh} />
      ) : null}

      <DataTable
        rows={rows as never[]}
        columns={tableColumns as never[]}
        rowKey={(row) => String((row as Record<string, unknown>)["id"])}
        caption={config.title}
        defaultOrder={config.defaultOrder}
        idPrefix={route}
        filtered={Boolean(filter)}
        truncated={isTruncated(
          ((records.data ?? []) as unknown[]).length,
          REQUEST_LIMIT,
        )}
        loading={records.loading}
        loaded={records.loaded}
        selectedKey={selectedKey ?? null}
        onSelect={onSelect ? (row) => onSelect(row as T) : undefined}
        emptyTitle={
          filter
            ? `No ${config.title.toLowerCase()} match this filter`
            : config.emptyTitle
        }
        emptyHint={
          filter
            ? "Clear the filter to see everything loaded."
            : config.emptyHint
        }
      />

      {acting ? (
        <>
          <div
            className="sheet-scrim"
            onClick={() => setActing(null)}
            aria-hidden="true"
          />
          <SessionRecovery
            session={acting as unknown as Session}
            tasks={(claimable.data ?? []) as TaskListRow[]}
            actorId={identity.actorId}
            onClose={() => {
              setActing(null);
              launcher.current?.focus();
            }}
            onRecovered={() => {
              records.refresh();
              claimable.refresh();
            }}
          />
        </>
      ) : null}
    </section>
  );
}
