/**
 * Startup identity bootstrap.
 *
 * Runs the sequence in ux-data-shape-and-workflow-spec.md section 5.1 and
 * exposes every state it requires: loading, created, existing, conflict,
 * unavailable, and retry. Mutation controls stay disabled until this resolves,
 * so the queue never flashes enabled actions with no accountable actor behind
 * them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordination } from "../api/coordination.ts";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";
import {
  CONSOLE_HARNESS,
  createOperatorRequest,
  evaluateOperator,
  findReusableSession,
  LOCAL_OPERATOR,
  newSessionId,
} from "./operatorIdentity.ts";

export type BootstrapPhase =
  | { kind: "loading" }
  | {
      kind: "ready";
      actorId: string;
      sessionId: string;
      actorCreated: boolean;
      sessionReused: boolean;
    }
  | { kind: "conflict"; reason: string }
  | { kind: "unavailable"; error: ApiError };

export interface Bootstrap {
  phase: BootstrapPhase;
  /** True once an accountable actor and matching active session both exist. */
  ready: boolean;
  retry: () => void;
}

export function useBootstrap(
  coordination: Coordination,
  onReady: (actorId: string, sessionId: string) => void,
): Bootstrap {
  const [phase, setPhase] = useState<BootstrapPhase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });

    void (async () => {
      try {
        const agents = await coordination.agents({ all: "1", limit: 500 });
        const check = evaluateOperator(agents);
        if (cancelled) return;

        if (check.kind === "conflict") {
          setPhase({ kind: "conflict", reason: check.reason });
          return;
        }

        let actorCreated = false;
        if (check.kind === "missing") {
          try {
            await coordination.createAgent(createOperatorRequest());
            actorCreated = true;
          } catch (caught) {
            // Two consoles launched together both saw the actor missing, and
            // the loser of that race used to fall into a generic "unavailable"
            // even though the winner had just created the record it wanted.
            //
            // `constraint_violation` is the contract's duplicate-id code, and
            // it is the only failure recovered here: anything else is a real
            // problem and must stay visible.
            if (!isDuplicate(caught)) throw caught;

            // Exactly one re-read, and the record still has to pass every
            // compatibility check. A duplicate id proves something occupies the
            // name, not that it is the actor we would have created.
            const reread = await coordination.agents({ all: "1", limit: 500 });
            if (cancelled) return;
            const settled = evaluateOperator(reread);
            if (settled.kind === "conflict") {
              setPhase({ kind: "conflict", reason: settled.reason });
              return;
            }
            if (settled.kind === "missing") throw caught;
            // Adopted, not created: the other instance made it.
          }
          if (cancelled) return;
        }

        const sessions = await coordination.sessions({
          agent: LOCAL_OPERATOR.id,
          status: "active",
          limit: 500,
        });
        if (cancelled) return;

        const reusable = findReusableSession(sessions, LOCAL_OPERATOR.id);
        let sessionId: string;
        let sessionReused = false;
        if (reusable) {
          sessionId = reusable.id;
          sessionReused = true;
          // Keep it off the stale-session health finding.
          await coordination.heartbeatSession(sessionId).catch(() => undefined);
        } else {
          try {
            const started = await coordination.startSession({
              id: newSessionId(),
              agent: LOCAL_OPERATOR.id,
              harness: CONSOLE_HARNESS,
              model: "",
            });
            sessionId = started.id;
          } catch (caught) {
            if (!isDuplicate(caught)) throw caught;

            // The id now carries entropy, so this is rare — but a same-second,
            // same-suffix collision is possible and must converge rather than
            // strand the operator on an unavailable screen.
            const reread = await coordination.sessions({
              agent: LOCAL_OPERATOR.id,
              status: "active",
              limit: 500,
            });
            if (cancelled) return;
            const adopted = findReusableSession(reread, LOCAL_OPERATOR.id);
            // Only an active console session belonging to this operator counts;
            // findReusableSession enforces all three.
            if (!adopted) throw caught;
            sessionId = adopted.id;
            sessionReused = true;
            await coordination.heartbeatSession(sessionId).catch(() => undefined);
          }
        }
        if (cancelled) return;

        setPhase({
          kind: "ready",
          actorId: LOCAL_OPERATOR.id,
          sessionId,
          actorCreated,
          sessionReused,
        });
        onReadyRef.current(LOCAL_OPERATOR.id, sessionId);
      } catch (caught) {
        if (cancelled) return;
        setPhase({
          kind: "unavailable",
          error:
            caught instanceof ApiError
              ? caught
              : new ApiError("network_error", describeThrown(caught), 0),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coordination, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { phase, ready: phase.kind === "ready", retry };
}


/**
 * Whether a failure is the contract's duplicate-id conflict.
 *
 * `constraint_violation` is the stable registry code for a duplicate id, and
 * matching on the code rather than the message is the point: the message is
 * free text that may carry a `database_error` detail from SQLite, and a startup
 * path that only converges when a string keeps its wording is not a fix.
 */
function isDuplicate(caught: unknown): boolean {
  return caught instanceof ApiError && caught.code === "constraint_violation";
}
