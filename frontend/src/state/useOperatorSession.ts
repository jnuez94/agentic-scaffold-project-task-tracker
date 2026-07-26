/**
 * The single source of truth for "which session is active right now".
 *
 * Owns the session list so every identity surface reads one resolved value
 * instead of each interpreting the persisted id for itself. A stale persisted
 * id is also cleared from storage, so the contradiction cannot survive a
 * reload.
 */

import { useEffect, useRef } from "react";
import type { Coordination } from "../api/coordination.ts";
import type { Session } from "../api/contract.ts";
import {
  isStaleSelection,
  resolveSession,
  selectableSessions,
  sessionReason,
  type SessionRejection,
} from "../lib/sessionIdentity.ts";
import { useResource } from "./useResource.ts";

export interface OperatorSession {
  /** Every session known to the project, for the selector. */
  sessions: Session[];
  /** Active sessions belonging to the selected actor. */
  selectable: Session[];
  /** The validated session id, or null. Every surface must use this. */
  activeSessionId: string | null;
  /** One canonical sentence explaining why there is no session, or null. */
  reason: string | null;
  rejection: SessionRejection | null;
  loading: boolean;
  loaded: boolean;
  refresh: () => void;
}

export function useOperatorSession(
  coordination: Coordination,
  actorId: string | null,
  persistedSessionId: string | null,
  onStaleCleared: () => void,
): OperatorSession {
  const resource = useResource(() => coordination.sessions({ limit: 500 }), [coordination]);
  const sessions = resource.data ?? [];

  // Before the list arrives there is nothing to validate against, so treat the
  // session as unresolved rather than trusting or discarding the stored id.
  const resolution = resource.loaded
    ? resolveSession(persistedSessionId, actorId, sessions)
    : { sessionId: null, rejection: persistedSessionId ? null : ("none-selected" as const) };

  const stale = resource.loaded && isStaleSelection(resolution.rejection);

  /**
   * Confirm once before destroying a selection.
   *
   * "Absent from the list" only proves staleness if the list could have
   * contained it, and on a clean launch it could not: the sessions are fetched
   * at mount, while bootstrap creates the session a moment later. The resolver
   * called that freshly adopted session `missing` and cleared it, so a ready
   * console showed "No session" with every mutation disabled — reliably when
   * two consoles start together, and on any genuinely clean first launch.
   *
   * So the first stale verdict for a given id buys one re-read, not a deletion.
   * If the id is still unusable afterwards it is genuinely stale and gets
   * cleared, which is what UI-14 requires of an ended or foreign session.
   * Bounded to one attempt per id, so a truly absent session cannot loop.
   */
  const confirmedFor = useRef<string | null>(null);
  const refresh = resource.refresh;
  // The verdict has to be re-evaluated when the confirming read lands, and
  // `stale` alone does not change across it — it was already true. lastUpdated
  // advances on every settled load, which is exactly the signal.
  const settledAt = resource.lastUpdated;

  useEffect(() => {
    if (!stale) return;
    if (confirmedFor.current === persistedSessionId) {
      onStaleCleared();
      return;
    }
    confirmedFor.current = persistedSessionId;
    refresh();
    // onStaleCleared is stable; re-running on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, persistedSessionId, refresh, settledAt]);

  return {
    sessions,
    selectable: selectableSessions(sessions, actorId),
    activeSessionId: resolution.sessionId,
    reason: resource.loaded ? sessionReason(resolution.rejection, actorId) : null,
    rejection: resolution.rejection,
    loading: resource.loading,
    loaded: resource.loaded,
    refresh: resource.refresh,
  };
}
