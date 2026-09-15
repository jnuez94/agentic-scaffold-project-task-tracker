/**
 * Column definitions for the audit log.
 *
 * Time leads because the log is read as "what happened most recently", and
 * the loaded window arrives newest first. Session sits last and lowest in
 * priority: nearly every row carries one, and it matters only when
 * attribution is in question.
 */

import type { Column } from "../components/DataTable.tsx";
import type { AuditEntry } from "../api/contract.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { humanize } from "../lib/labels.ts";

export const AUDIT_DEFAULT_ORDER = "newest first";

export const AUDIT_COLUMNS: Column<AuditEntry>[] = [
  {
    key: "when",
    header: "When",
    priority: 1,
    render: (entry) => (
      <span className="small" title={absoluteTime(entry.created_at)}>
        {relativeTime(entry.created_at)}
      </span>
    ),
    sortValue: (entry) => entry.created_at,
  },
  {
    key: "action",
    header: "Action",
    priority: 2,
    render: (entry) => <strong>{humanize(entry.action)}</strong>,
    sortValue: (entry) => entry.action,
  },
  {
    key: "object",
    header: "Object",
    priority: 3,
    render: (entry) => (
      <span>
        <span className="muted">{entry.object_type}</span>{" "}
        <span className="mono">{entry.object_id}</span>
      </span>
    ),
    sortValue: (entry) => `${entry.object_type} ${entry.object_id}`,
  },
  {
    key: "actor",
    header: "Actor",
    priority: 4,
    render: (entry) => <span className="mono">{entry.actor}</span>,
    sortValue: (entry) => entry.actor,
  },
  {
    key: "detail",
    header: "Detail",
    priority: 5,
    render: (entry) => <span className="small">{entry.detail}</span>,
    sortValue: (entry) => entry.detail,
    vacantFor: (entry) => !entry.detail,
  },
  {
    key: "session",
    header: "Session",
    priority: 6,
    render: (entry) =>
      entry.session_id ? (
        <span className="mono small">{entry.session_id}</span>
      ) : (
        <span className="muted small">—</span>
      ),
    sortValue: (entry) => entry.session_id,
    vacantFor: (entry) => !entry.session_id,
  },
];
