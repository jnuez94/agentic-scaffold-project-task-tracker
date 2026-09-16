/**
 * The audit log.
 *
 * A loaded window like every other list, with two differences. It grows
 * backwards: "Load older" appends the page before the oldest row until the
 * beginning of the log is reached (UI-64). And its pickers are part of the
 * request (UI-66): choosing "task" asks for the newest 500 task events, not
 * the tasks among 500 mixed ones, so the pickers offer the whole vocabulary
 * rather than what the window happened to contain. The filter box stays
 * client-side over what is loaded, because free text has no CLI equivalent.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner, LiveRegion } from "../components/Feedback.tsx";
import {
  AUDIT_ACTIONS,
  AUDIT_OBJECT_TYPES,
  auditRequestParams,
  auditWindowNoun,
  heartbeatsHidden,
} from "../lib/auditVocabulary.ts";
import { AUDIT_FILTER_FIELDS, auditRangeLabel } from "../lib/auditWindow.ts";
import { CLEAR_FILTER_HINT } from "../lib/copy.ts";
import { filterRows } from "../lib/filters.ts";
import { useApp } from "../state/AppContext.tsx";
import { useAuditWindow } from "../state/useAuditWindow.ts";
import { AUDIT_COLUMNS, AUDIT_DEFAULT_ORDER } from "./auditColumns.tsx";
import { AuditLoadOlder } from "./AuditLoadOlder.tsx";

const REQUEST_LIMIT = 500;

export function AuditView({ filter }: { filter: string }) {
  const { coordination } = useApp();
  const [objectType, setObjectType] = useState("");
  const [action, setAction] = useState("");
  const [showHeartbeats, setShowHeartbeats] = useState(false);

  const pickers = useMemo(
    () => ({ objectType, action, showHeartbeats }),
    [objectType, action, showHeartbeats],
  );
  const hidingHeartbeats = heartbeatsHidden(pickers);
  const params = useMemo(() => auditRequestParams(pickers), [pickers]);
  const noun = auditWindowNoun(pickers);
  const audit = useAuditWindow((query) => coordination.audit(query), REQUEST_LIMIT, params);
  const loaded = audit.rows;

  const rows = useMemo(() => filterRows(loaded, AUDIT_FILTER_FIELDS, filter), [loaded, filter]);
  const narrowed = Boolean(filter);

  // A picker change is a reload the operator asked for: say so once it lands,
  // including that the table is back on page one. Keyed on the window the
  // hook actually holds, not on loading flags — those flip across renders and
  // an effect reading them can announce the old rows under the new key. The
  // first window is not announced: arriving on a route is not a reload.
  const requestKey = JSON.stringify(params);
  const announcedKey = useRef<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!audit.windowKey) return;
    if (announcedKey.current === null) {
      announcedKey.current = audit.windowKey;
      return;
    }
    if (announcedKey.current === audit.windowKey) return;
    announcedKey.current = audit.windowKey;
    const what = noun ? `the newest ${loaded.length} ${noun}` : `the newest ${loaded.length} entries`;
    setNotice(`Reloaded: ${what}. Page 1.`);
  }, [audit.windowKey, noun, loaded.length]);

  return (
    <section className="audit" aria-label="Audit log" aria-busy={audit.loading}>
      <div className="view-header">
        <h1>Audit log</h1>
        <p className="small muted">
          Every audited mutation, newest first. The newest {REQUEST_LIMIT} entries are loaded;
          the type and action pickers and the filter box narrow them.
          {hidingHeartbeats ? " Heartbeats are hidden." : ""}
        </p>
      </div>

      <div className="queue-toolbar">
        <div className="control">
          <label htmlFor="audit-object">Object type</label>
          <select
            id="audit-object"
            value={objectType}
            onChange={(event) => setObjectType(event.target.value)}
          >
            <option value="">All types</option>
            {AUDIT_OBJECT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="audit-action">Action</label>
          <select id="audit-action" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {/* UI-60: a default-view exclusion, visible and reversible. Asking
            for heartbeats by action overrides it without touching this. */}
        <label className="control control-check">
          <input
            type="checkbox"
            checked={showHeartbeats}
            onChange={(event) => setShowHeartbeats(event.target.checked)}
          />
          Show heartbeats
        </label>
        {audit.loading && audit.loaded ? (
          <p className="queue-count small muted">Loading…</p>
        ) : null}
      </div>

      <LiveRegion message={notice} />

      {audit.error ? <ErrorBanner error={audit.error} onRetry={audit.refresh} /> : null}

      <DataTable
        // Keyed by the request, so a reload starts on page one with the sort
        // cleared; refreshing or loading older keeps the operator where they are.
        key={requestKey}
        rows={rows}
        columns={AUDIT_COLUMNS}
        rowKey={(entry) => String(entry.id)}
        caption="Audit log"
        defaultOrder={AUDIT_DEFAULT_ORDER}
        idPrefix="audit"
        filtered={narrowed}
        truncated={loaded.length >= REQUEST_LIMIT}
        loading={audit.loading && !audit.loaded}
        loaded={audit.loaded}
        emptyTitle={narrowed ? "No loaded entries match this filter" : "No audit entries"}
        emptyHint={
          narrowed
            ? CLEAR_FILTER_HINT
            : noun
              ? `The log holds no ${noun}.`
              : "Mutations made through the CLI or this console are recorded here."
        }
        // The one list where truncation is the permanent state, so the shared
        // hedge ("may exist") would misstate a certainty. The notice's slot
        // holds the way back instead: load the page before the oldest row.
        pagerCopy={{
          rangeLabel: (page, size, total) =>
            auditRangeLabel(page, size, total, { window: loaded.length, narrowed, noun }),
          truncatedNotice: ({ announce }) => (
            <AuditLoadOlder
              exhausted={audit.exhausted}
              loading={audit.loading}
              onLoad={() => {
                announce();
                audit.loadOlder();
              }}
            />
          ),
        }}
      />
    </section>
  );
}
