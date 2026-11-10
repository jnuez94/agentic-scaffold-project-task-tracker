/**
 * "Since you loaded it" (UI-33): the changes a compare-and-swap refusal lost
 * to, under the refusal itself, so the operator can decide whether their
 * change still makes sense without leaving for the audit log.
 *
 * Read from the record's audit rows when the refusal is shown. If they cannot
 * be read, or place nothing after the loaded state, nothing renders and the
 * banner stays as it was. The draft is untouched either way; "Reload latest"
 * stays the only action.
 */

import type { AuditEntry } from "../api/contract.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { changesSince, collisionLine, describeChange, type Editing, type Loaded } from "../lib/sinceLoaded.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const SHOWN = 5;
const HISTORY_LIMIT = 100;

export function SinceLoaded({
  objectType,
  objectId,
  loaded,
  editing,
  onShowActivity,
}: {
  objectType: string;
  objectId: string;
  loaded: Loaded;
  editing?: Editing;
  /** Opens the record's Activity tab, where the rest of the history is. */
  onShowActivity?: () => void;
}) {
  const { coordination } = useApp();
  const history = useResource<AuditEntry[]>(
    () => coordination.audit({ object_type: objectType, object_id: objectId, limit: HISTORY_LIMIT }),
    [coordination, objectType, objectId],
  );
  if (!history.data) return null;
  const changes = changesSince(history.data, loaded);
  if (!changes.length) return null;

  const collision = collisionLine(changes, editing, loaded);
  const more = changes.length - SHOWN;

  return (
    <div className="since-loaded">
      <p className="since-loaded-title">Since you loaded it</p>
      {collision ? <p className="since-loaded-collision">{collision}</p> : null}
      <ul>
        {changes.slice(0, SHOWN).map((entry) => (
          <li key={entry.id}>
            {describeChange(entry)} · <span className="mono">{entry.actor}</span> ·{" "}
            <span title={absoluteTime(entry.created_at)}>{relativeTime(entry.created_at)}</span>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        onShowActivity ? (
          <button type="button" className="link-button" onClick={onShowActivity}>
            and {more} more in Activity
          </button>
        ) : (
          <p className="small muted">and {more} more in Activity</p>
        )
      ) : null}
    </div>
  );
}
