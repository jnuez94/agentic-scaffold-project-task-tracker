/**
 * A task change refused as stale_task_revision: what happened, what changed
 * since the task was loaded (UI-33), and the one recovery — reload latest,
 * with the operator's draft kept.
 */

import type { ApiError } from "../api/errors.ts";
import { EDITING } from "../lib/sinceLoaded.ts";
import { SinceLoaded } from "./SinceLoaded.tsx";

export function ConflictBanner({
  error,
  taskId,
  currentRevision,
  onReload,
  onShowActivity,
}: {
  error: ApiError;
  taskId: string;
  currentRevision: number;
  onReload: () => void;
  onShowActivity?: () => void;
}) {
  const actual = error.actualRevision;
  return (
    <div className="conflict" role="alert">
      <div>
        <p className="conflict-title">{actual ? `Task changed to revision ${actual}` : "This task changed"}</p>
        {/* What changed comes straight after the title: the footer is short,
            and this is the part that decides whether the draft still holds. */}
        <SinceLoaded
          objectType="task"
          objectId={taskId}
          loaded={{ revision: currentRevision }}
          editing={EDITING.status}
          onShowActivity={onShowActivity}
        />
        <p className="small">You submitted revision {currentRevision}. Reload latest; your draft will be preserved.</p>
      </div>
      <button onClick={onReload}>Reload latest</button>
    </div>
  );
}
