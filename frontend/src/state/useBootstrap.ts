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
          await coordination.createAgent(createOperatorRequest());
          actorCreated = true;
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
          const started = await coordination.startSession({
            id: newSessionId(),
            agent: LOCAL_OPERATOR.id,
            harness: CONSOLE_HARNESS,
            model: "",
          });
          sessionId = started.id;
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
              : new ApiError("network_error", describe(caught), 0),
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

function describe(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return "The console could not reach the local server.";
}
