/**
 * One record's timeline (UI-69): its audit rows, newest first.
 *
 * The same data `<entity> history ID` returns, read through the audit route
 * the console already has — the contract says the two are the same rows
 * spelled from different sides. Rendered only for a record that resolved,
 * so an empty list truthfully means nothing was recorded, never "unknown id".
 */

import type { AuditEntry } from "../api/contract.ts";
import { AuditDetail } from "../components/AuditDetail.tsx";
import { EmptyState, ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { humanize } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const HISTORY_LIMIT = 50;

export function RecordActivity({ objectType, objectId }: { objectType: string; objectId: string }) {
  const { coordination } = useApp();
  const audit = useResource(
    () => coordination.audit({ object_type: objectType, object_id: objectId, limit: HISTORY_LIMIT }),
    [objectType, objectId],
  );

  if (audit.error) return <ErrorBanner error={audit.error} onRetry={audit.refresh} />;
  if (!audit.loaded) return <SkeletonRows rows={3} columns={2} />;
  const entries = audit.data ?? [];
  if (entries.length === 0) return <EmptyState title="No recorded activity" />;
  return <ActivityTimeline entries={entries} />;
}

export function ActivityTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <ul className="timeline">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <div className="small">
              <strong>{humanize(entry.action)}</strong> by <span className="mono">{entry.actor}</span>
            </div>
            <div className="small muted" title={absoluteTime(entry.created_at)}>
              {relativeTime(entry.created_at)}
              {entry.session_id ? ` · session ${entry.session_id}` : ""}
            </div>
            {entry.detail ? <AuditDetail detail={entry.detail} className="small muted" /> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
