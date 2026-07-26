/**
 * Startup identity states.
 *
 * The conflict and unavailable states are persistent and offer a recovery
 * action rather than disappearing, because in both cases every mutation
 * control stays disabled until the operator does something about it.
 */

import type { BootstrapPhase } from "../state/useBootstrap.ts";
import { LOCAL_OPERATOR } from "../state/operatorIdentity.ts";

export function StartupBanner({
  phase,
  onRetry,
}: {
  phase: BootstrapPhase;
  onRetry: () => void;
}) {
  if (phase.kind === "ready") return null;

  if (phase.kind === "loading") {
    return (
      <div className="startup-banner loading" role="status" aria-live="polite">
        <span className="startup-glyph" aria-hidden="true">
          ◐
        </span>
        <div>
          <p className="startup-title">Setting up the local operator</p>
          <p className="small muted">
            Mutation controls stay disabled until an accountable actor and an active
            session are both resolved.
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === "conflict") {
    return (
      <div className="startup-banner conflict-banner" role="alert">
        <span className="startup-glyph" aria-hidden="true">
          !
        </span>
        <div>
          <p className="startup-title">Identity setup conflict</p>
          <p className="small">{phase.reason}</p>
          <p className="small muted">
            Nothing was changed. Reads work normally; mutations stay disabled until
            the <span className="mono">{LOCAL_OPERATOR.id}</span> record is resolvable,
            or until you pick another actor in the header.
          </p>
        </div>
        <button onClick={onRetry}>Re-check</button>
      </div>
    );
  }

  return (
    <div className="startup-banner unavailable" role="alert">
      <span className="startup-glyph" aria-hidden="true">
        !
      </span>
      <div>
        <p className="startup-title">Could not complete identity setup</p>
        <p className="small">{phase.error.message}</p>
        <p className="small muted mono">{phase.error.code}</p>
      </div>
      <button onClick={onRetry}>Retry setup</button>
    </div>
  );
}
