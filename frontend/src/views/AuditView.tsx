/**
 * The audit timeline.
 *
 * This is the one list with a real total: the read-only query computes an
 * unpaged COUNT alongside the page, so "N of M" here is truthful in a way it
 * would not be for CLI-backed lists.
 */

import { useState } from "react";
import { ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { humanize } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const PAGE_SIZE = 50;

export function AuditView({ filter }: { filter: string }) {
  const { coordination } = useApp();
  const [objectType, setObjectType] = useState("");
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);

  const audit = useResource(
    () =>
      coordination.audit({
        limit: PAGE_SIZE,
        offset,
        object_type: objectType || undefined,
        action: action || undefined,
        q: filter || undefined,
      }),
    [objectType, action, offset, filter],
  );

  const page = audit.data;
  const entries = page?.entries ?? [];
  const total = page?.total ?? 0;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + entries.length, total);

  const reset = (apply: () => void) => {
    setOffset(0);
    apply();
  };

  return (
    <section className="audit" aria-label="Audit log">
      <div className="view-header">
        <h1>Audit log</h1>
        <p className="small muted">
          Every audited mutation, newest first. Read directly from SQLite through a
          query-only connection; the CLI has no audit command.
        </p>
      </div>

      <div className="queue-toolbar">
        <div className="control">
          <label htmlFor="audit-object">Object type</label>
          <select
            id="audit-object"
            value={objectType}
            onChange={(event) => reset(() => setObjectType(event.target.value))}
          >
            <option value="">All types</option>
            {(page?.facets.object_types ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="audit-action">Action</label>
          <select
            id="audit-action"
            value={action}
            onChange={(event) => reset(() => setAction(event.target.value))}
          >
            <option value="">All actions</option>
            {(page?.facets.actions ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <p className="queue-count small muted" aria-live="polite">
          {total === 0 ? "No entries" : `${first}–${last} of ${total}`}
        </p>
        <div className="pager">
          <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}>
            Previous
          </button>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + entries.length >= total}
          >
            Next
          </button>
        </div>
      </div>

      {audit.error ? <ErrorBanner error={audit.error} onRetry={audit.refresh} /> : null}
      {!audit.loaded && audit.loading ? <SkeletonRows rows={8} columns={3} /> : null}

      <ul className="timeline audit-timeline">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="timeline-dot" aria-hidden="true" />
            <div className="audit-entry">
              <div>
                <strong>{humanize(entry.action)}</strong>{" "}
                <span className="muted">{entry.object_type}</span>{" "}
                <span className="mono">{entry.object_id}</span>
              </div>
              <div className="small muted">
                <span className="mono">{entry.actor}</span>
                {entry.session_id ? <> · session <span className="mono">{entry.session_id}</span></> : null}
                {" · "}
                <span title={absoluteTime(entry.created_at)}>{relativeTime(entry.created_at)}</span>
              </div>
              {entry.detail ? <div className="small">{entry.detail}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
