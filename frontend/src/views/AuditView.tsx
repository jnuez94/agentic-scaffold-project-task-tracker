/**
 * The audit log.
 *
 * A loaded window like every other list, with one difference: it grows
 * backwards. `/api/audit` returns the newest REQUEST_LIMIT entries and no
 * total; the pickers list the values present in what is loaded, the filter
 * box narrows it, and "Load older" appends the page before the oldest row
 * until the beginning of the log is reached (UI-64).
 */

import { useMemo, useState } from "react";
import { DataTable } from "../components/DataTable.tsx";
import { ErrorBanner } from "../components/Feedback.tsx";
import { AUDIT_FILTER_FIELDS, auditRangeLabel, facetValues, narrowAudit } from "../lib/auditWindow.ts";
import { CLEAR_FILTER_HINT } from "../lib/copy.ts";
import { filterRows } from "../lib/filters.ts";
import { isTruncated } from "../lib/pagination.ts";
import { useApp } from "../state/AppContext.tsx";
import { useAuditWindow } from "../state/useAuditWindow.ts";
import { AUDIT_COLUMNS, AUDIT_DEFAULT_ORDER } from "./auditColumns.tsx";
import { AuditLoadOlder } from "./AuditLoadOlder.tsx";

const REQUEST_LIMIT = 500;

export function AuditView({ filter }: { filter: string }) {
  const { coordination } = useApp();
  const [objectType, setObjectType] = useState("");
  const [action, setAction] = useState("");

  const audit = useAuditWindow((query) => coordination.audit(query), REQUEST_LIMIT);
  const loaded = audit.rows;

  const objectTypes = useMemo(() => facetValues(loaded, "object_type"), [loaded]);
  const actions = useMemo(() => facetValues(loaded, "action"), [loaded]);
  const rows = useMemo(
    () => filterRows(narrowAudit(loaded, { objectType, action }), AUDIT_FILTER_FIELDS, filter),
    [loaded, objectType, action, filter],
  );
  const narrowed = Boolean(filter) || Boolean(objectType) || Boolean(action);

  return (
    <section className="audit" aria-label="Audit log">
      <div className="view-header">
        <h1>Audit log</h1>
        <p className="small muted">
          Every audited mutation, newest first. The newest {REQUEST_LIMIT} entries are loaded;
          the type and action pickers and the filter box narrow them.
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
            {objectTypes.map((value) => (
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
            {actions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {audit.error ? <ErrorBanner error={audit.error} onRetry={audit.refresh} /> : null}

      <DataTable
        rows={rows}
        columns={AUDIT_COLUMNS}
        rowKey={(entry) => String(entry.id)}
        caption="Audit log"
        defaultOrder={AUDIT_DEFAULT_ORDER}
        idPrefix="audit"
        filtered={narrowed}
        truncated={isTruncated(loaded.length, REQUEST_LIMIT)}
        loading={audit.loading && !audit.loaded}
        loaded={audit.loaded}
        emptyTitle={narrowed ? "No loaded entries match this filter" : "No audit entries"}
        emptyHint={
          narrowed
            ? CLEAR_FILTER_HINT
            : "Mutations made through the CLI or this console are recorded here."
        }
        // The one list where truncation is the permanent state, so the shared
        // hedge ("may exist") would misstate a certainty. The notice's slot
        // holds the way back instead: load the page before the oldest row.
        pagerCopy={{
          rangeLabel: (page, size, total) =>
            auditRangeLabel(page, size, total, { window: loaded.length, narrowed }),
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
