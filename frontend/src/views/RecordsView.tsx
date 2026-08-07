/**
 * Generic entity browser driven by RECORD_CONFIGS.
 */

import { useMemo, useRef, useState } from "react";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { filterRows } from "../lib/filters.ts";
import { CLEAR_FILTER_HINT } from "../lib/copy.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { useRecordData } from "../state/useRecordData.ts";
import type { RouteName } from "../state/useHashRoute.ts";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";
import { withActionColumn } from "./recordActionColumn.tsx";
import { INSPECTOR_CONFIGS } from "./inspectorConfigs.tsx";
import { RecordPanels } from "./RecordPanels.tsx";

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
  const inspectorConfig = INSPECTOR_CONFIGS[route];
  const [statusValue, setStatusValue] = useState("");
  const [acting, setActing] = useState<Record<string, unknown> | null>(null);
  // Selection is view state only. These entities have no `show` command, so a
  // deep-link route would promise a record the CLI cannot resolve on load.
  const [inspecting, setInspecting] = useState<Record<string, unknown> | null>(
    null,
  );
  const rowTrigger = useRef<HTMLElement | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);

  const { records, tasks, sessions } = useRecordData(
    coordination,
    route,
    config,
    statusValue,
    reloadKey,
  );

  const tableColumns = useMemo(
    () =>
      config
        ? withActionColumn(config, (row, trigger) => {
            launcher.current = trigger;
            setActing(row);
          })
        : [],
    [config],
  );

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
    <div
      className={
        inspecting ? "records-layout with-inspector" : "records-layout"
      }
    >
      <section className="records" aria-label={config.title}>
        <div className="view-header">
          <h1>{config.title}</h1>
          <p className="small muted">{config.description}</p>
        </div>

        <div className="queue-toolbar">
          {config.statusOptions ? (
            <div className="control">
              <label htmlFor="record-status">
                {config.statusOptions.label}
              </label>
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
          columns={tableColumns}
          rowKey={(row) => String((row as Record<string, unknown>)["id"])}
          caption={config.title}
          defaultOrder={config.defaultOrder}
          idPrefix={route}
          filtered={Boolean(filter)}
          truncated={isTruncated(
            ((records.data ?? [])).length,
            REQUEST_LIMIT,
          )}
          loading={records.loading}
          loaded={records.loaded}
          selectedKey={
            selectedKey ?? (inspecting ? String(inspecting["id"]) : null)
          }
          onSelect={
            onSelect
              ? (row) => onSelect(row)
              : inspectorConfig
                ? (row) => {
                    rowTrigger.current = document.activeElement as HTMLElement;
                    setInspecting(row);
                  }
                : undefined
          }
          emptyTitle={
            filter
              ? `No ${config.title.toLowerCase()} match this filter`
              : config.emptyTitle
          }
          emptyHint={
            filter
              ? CLEAR_FILTER_HINT
              : config.emptyHint
          }
        />
      </section>

      <RecordPanels
        config={config}
        inspectorConfig={inspectorConfig}
        inspecting={inspecting}
        acting={acting}
        tasks={(tasks.data ?? [])}
        sessions={(sessions.data ?? [])}
        actorId={identity.actorId}
        onCloseInspector={() => {
          setInspecting(null);
          rowTrigger.current?.focus();
        }}
        onCloseAction={() => {
          setActing(null);
          launcher.current?.focus();
        }}
        onAct={(row) => setActing(row)}
        onRecovered={() => {
          records.refresh();
          tasks.refresh();
        }}
      />
    </div>
  );
}
