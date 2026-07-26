/**
 * The single source of truth for "which session is active right now".
 *
 * Owns the session list so every identity surface reads one resolved value
 * instead of each interpreting the persisted id for itself. A stale persisted
 * id is also cleared from storage, so the contradiction cannot survive a
 * reload.
 */

import { useEffect } from "react";
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

  useEffect(() => {
    if (stale) onStaleCleared();
    // onStaleCleared is stable; re-running on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

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
