/**
 * Generic entity browser driven by RECORD_CONFIGS.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/errors.ts";
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
  detail = null,
  onDetail,
}: {
  route: RouteName;
  filter: string;
  /** Bumped by a caller to force a refetch, e.g. after sending a broadcast. */
  reloadKey?: number;
  /** Receives the already-loaded row, so a detail view needs no extra query. */
  onSelect?: (row: T) => void;
  selectedKey?: string | null;
  /**
   * The record named in the route, `#/decisions/DEC-1` (UI-69). Resolved
   * from the loaded rows when one matches, through `show` when none does;
   * an unknown id gets the not-found treatment.
   */
  detail?: string | null;
  /** Called with the inspected id, or null when the inspector closes. */
  onDetail?: (id: string | null) => void;
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
  const [missing, setMissing] = useState<ApiError | null>(null);
  // What the route said last time, so "the route cleared its detail" can be
  // told apart from "this view has no routing at all".
  const previousDetail = useRef<string | null>(detail);
  const rowTrigger = useRef<HTMLElement | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);

  const { records, tasks, sessions } = useRecordData(
    coordination,
    route,
    config,
    statusValue,
    reloadKey,
  );

  // Resolve the route's record. A row already loaded costs no request — that
  // is every open-from-a-row case — and only an id the window does not hold
  // is asked for by name. A cleared detail closes the inspector.
  useEffect(() => {
    const changed = previousDetail.current !== detail;
    previousDetail.current = detail;
    if (!detail) {
      if (changed && inspecting) setInspecting(null);
      if (changed) setMissing(null);
      return;
    }
    if (inspecting && String(inspecting["id"]) === detail) return;
    const loaded = ((records.data ?? []) as Record<string, unknown>[]).find(
      (row) => String(row["id"]) === detail,
    );
    if (loaded) {
      setInspecting(loaded);
      setMissing(null);
      return;
    }
    if (!records.loaded) return;
    let stale = false;
    coordination
      .show(route, detail)
      .then((row) => {
        if (stale) return;
        setInspecting(row);
        setMissing(null);
      })
      .catch((caught: unknown) => {
        if (stale) return;
        // The route names a record that did not resolve: nothing is inspected,
        // so a record opened earlier must not stand in for it.
        setInspecting(null);
        setMissing(
          caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0),
        );
      });
    return () => {
      stale = true;
    };
    // `inspecting` is read, not depended on: resolving it must not re-run when it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, records.data, records.loaded, route, coordination]);

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

  // The inspector shows the record as it is now, not as it was when opened:
  // after a refresh the row it holds is looked up again by id, so a ruling
  // made from the inspector is visible in the inspector (UI-73).
  const inspected = useMemo(() => {
    if (!inspecting) return null;
    const id = String(inspecting["id"]);
    const fresh = ((records.data ?? []) as Record<string, unknown>[]).find(
      (row) => String(row["id"]) === id,
    );
    return fresh ?? inspecting;
  }, [inspecting, records.data]);

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
        {missing ? (
          <ErrorBanner
            error={missing}
            onDismiss={() => {
              setMissing(null);
              onDetail?.(null);
            }}
          />
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
                    onDetail?.(String(row["id"]));
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
        inspecting={inspected}
        acting={acting}
        tasks={(tasks.data ?? [])}
        sessions={(sessions.data ?? [])}
        actorId={identity.actorId}
        onCloseInspector={() => {
          setInspecting(null);
          onDetail?.(null);
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
