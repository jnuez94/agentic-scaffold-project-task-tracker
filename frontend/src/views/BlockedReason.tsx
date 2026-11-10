/**
 * "Why this is blocked" on a blocked task's Overview (UI-83): what it waits
 * on, the cause cited when it was blocked, or a stated absence. Never the
 * "Does not authorize" boundary and never the notes — see lib/blockedReason.
 *
 * Two reads, both small and both only for a blocked task: the statuses of the
 * tasks it waits on, in one list call, and its status history for the cause.
 * The dependencies themselves are already on the task.
 */

import { Fragment, useMemo } from "react";
import type { TaskDetail } from "../api/contract.ts";
import { becauseHref, describeCause } from "../lib/because.ts";
import {
  BLOCKING_ACTIONS,
  blockingCause,
  blockingRecovery,
  blockingTaskIds,
  NO_RECORDED_REASON,
  waitsOn,
} from "../lib/blockedReason.ts";
import { useApp } from "../state/AppContext.tsx";
import { buildHash } from "../state/useHashRoute.ts";
import { useResource } from "../state/useResource.ts";

const HISTORY_LIMIT = 50;

export function BlockedReason({ detail }: { detail: TaskDetail }) {
  const { coordination } = useApp();
  const ids = useMemo(() => blockingTaskIds(detail.id, detail.dependencies), [detail.id, detail.dependencies]);
  const key = ids.join(",");

  const blockers = useResource(
    () => coordination.tasks({ where: [`id:in=${key}`], limit: ids.length }),
    [coordination, key],
    { enabled: ids.length > 0 },
  );
  const history = useResource(
    // Status moves and session recoveries both move a task into blocked.
    () =>
      Promise.all(
        BLOCKING_ACTIONS.map((action) =>
          coordination.audit({ object_type: "task", object_id: detail.id, action, limit: HISTORY_LIMIT }),
        ),
      ).then((pages) => pages.flat()),
    [coordination, detail.id, detail.revision],
  );

  const waits = waitsOn(ids, blockers.data ?? []);
  // Only this task's rows, whatever the resource still holds.
  // And nothing from before a failed read: the cause may have changed since.
  const own = history.error ? [] : (history.data ?? []).filter((entry) => entry.object_id === detail.id);
  const cause = blockingCause(own);
  const recovery = blockingRecovery(own);

  return (
    <div className="blocked-reason" role="note">
      <span className="field-label">Why this is blocked</span>
      {waits.length ? (
        <p>
          Waits on{" "}
          {waits.map((item, index) => (
            <Fragment key={item.id}>
              {index === 0 ? "" : index === waits.length - 1 ? " and " : ", "}
              <a className="mono" href={buildHash("tasks", item.id)}>
                {item.id}
              </a>
              {item.status ? ` (${item.status})` : ""}
            </Fragment>
          ))}
          .
        </p>
      ) : null}
      {cause ? (
        <p>
          Blocked because of <a href={becauseHref(cause)}>{describeCause(cause)}</a>.
        </p>
      ) : null}
      {recovery ? (
        <p>
          Blocked when {recovery.session ? <span className="mono">session {recovery.session}</span> : "its session"}{" "}
          was recovered{recovery.reason ? `: ${recovery.reason}` : ""}.
        </p>
      ) : null}
      {history.error ? (
        // Unread is not absent: a failed read must not say no reason was recorded.
        <p className="small" role="alert">
          The reason could not be read.{" "}
          <button type="button" className="link" onClick={history.refresh}>
            Try again
          </button>
        </p>
      ) : null}
      {!waits.length && !cause && !recovery && history.loaded && !history.error ? (
        <p className="small muted">{NO_RECORDED_REASON}</p>
      ) : null}
    </div>
  );
}
