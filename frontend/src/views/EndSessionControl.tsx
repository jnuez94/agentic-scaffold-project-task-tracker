/**
 * Ending your own session, from the identity surface (UI-51).
 *
 * Placement first: this lives in the top bar's identity popover, beside the
 * session it acts on, and deliberately nowhere near the Sessions table's
 * Recover action. Ruling: the two controls never sit adjacent, because ending
 * and recovering read as near-synonyms and are near-opposites — ending
 * REFUSES to touch claims; recovery blocks the claimed tasks, increments
 * their revisions, appends a reason, and clears the claims.
 *
 * The disable rule replaces an earlier ruling that this control should warn.
 * Checked against the CLI: `session end` refuses outright with
 * `session_has_active_claims` and there is no force flag, so a warning would
 * describe behaviour that does not exist. Offering the button and letting it
 * fail was rejected too — it teaches pressing a control that does not work.
 * So while claims are held the control is disabled, says why, names the
 * tasks, and points at Release, which already exists on the task row and in
 * the inspector. This component never becomes a third home for Release.
 *
 * Mounted only while the popover is open, so the task fetch that the claims
 * check needs is paid on open, not on every render of the bar.
 */

import { useState } from "react";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";
import { tasksClaimedBy } from "../lib/staleness.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

export function EndSessionControl({
  sessionId,
  onEnded,
}: {
  /** The active, validated session — the only one this control may end. */
  sessionId: string;
  /** Clears the persisted selection and refreshes whatever shows sessions. */
  onEnded: () => void;
}) {
  const { coordination, announce } = useApp();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const tasks = useResource(() => coordination.tasks({ limit: 500 }), [coordination]);
  const claimed = tasksClaimedBy(tasks.data ?? [], sessionId);
  // Unknown is treated as held: enabling End before the claims load risks
  // offering an action the CLI will refuse, which is the pattern this
  // ruling exists to prevent. The moment of doubt lasts one fetch.
  const blocked = !tasks.loaded || claimed.length > 0;

  const end = async () => {
    if (pending || blocked) return;
    setFailure(undefined);
    setPending(true);
    try {
      await coordination.endSession(sessionId);
      // Outcome and consequence (UI-32). "Orderly" is the point: this is the
      // finishing-for-the-day action, not an intervention.
      announce(
        `Session ${sessionId} ended. Nothing was blocked and no claims were touched.`,
      );
      onEnded();
    } catch (caught) {
      setFailure(
        caught instanceof ApiError ? caught.message : describeThrown(caught),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="end-session">
      <button
        type="button"
        disabled={pending || blocked}
        aria-describedby={blocked && tasks.loaded ? "end-session-reason" : undefined}
        onClick={() => void end()}
      >
        {pending ? "Ending…" : "End session"}
      </button>
      {tasks.loaded && claimed.length > 0 ? (
        <p id="end-session-reason" className="small muted">
          This session holds {claimed.length === 1 ? "a claim" : "claims"} on{" "}
          <span className="mono">{claimed.map((task) => task.id).join(", ")}</span>.
          Release {claimed.length === 1 ? "it" : "them"} from the task queue first —
          ending will be refused while any claim is held.
        </p>
      ) : null}
      {failure ? (
        <p className="small field-problem" role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
