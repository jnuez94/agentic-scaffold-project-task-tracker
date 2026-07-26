/**
 * Reconciling a persisted session selection against reality.
 *
 * The bug this exists to prevent (design-qa.md pass 2, P1): a session id
 * restored from storage was displayed as the active session even when it had
 * ended or belonged to a different actor. The top selector showed "No session"
 * because the id matched no option, while the sidebar and the task footer
 * happily printed the stale id — so the operator could not tell which session
 * would audit an action.
 *
 * The rule is one function, and every identity surface reads its result.
 */

import type { Session } from "../api/contract.ts";

export type SessionRejection = "none-selected" | "missing" | "ended" | "wrong-actor";

export interface SessionResolution {
  /** The id every surface should display and send, or null when there is none. */
  sessionId: string | null;
  /** Why there is no usable session; null when one resolved. */
  rejection: SessionRejection | null;
}

/**
 * Keep a persisted session only when it exists, is active, and belongs to the
 * selected actor. Anything else resolves to null with a reason.
 */
export function resolveSession(
  persistedId: string | null,
  actorId: string | null,
  sessions: readonly Session[],
): SessionResolution {
  if (!persistedId) return { sessionId: null, rejection: "none-selected" };

  const found = sessions.find((session) => session.id === persistedId);
  if (!found) return { sessionId: null, rejection: "missing" };
  if (found.status !== "active") return { sessionId: null, rejection: "ended" };
  if (actorId && found.agent_id !== actorId) {
    return { sessionId: null, rejection: "wrong-actor" };
  }
  return { sessionId: found.id, rejection: null };
}

/**
 * One sentence per rejection, used by every disabled control.
 *
 * Centralised deliberately: the QA finding was partly that different surfaces
 * described the same condition differently, so the operator saw
 * "select a session" beside a surface claiming one was already selected.
 */
export function sessionReason(
  rejection: SessionRejection | null,
  actorId: string | null,
): string | null {
  if (rejection === null) return null;
  if (!actorId) return "Select an actor, then an active session, to act.";
  switch (rejection) {
    case "none-selected":
      return `No active session is selected for ${actorId}. Start or select one in the header.`;
    case "missing":
      return `The previously selected session no longer exists. Select an active session for ${actorId}.`;
    case "ended":
      return `The previously selected session has ended. Select an active session for ${actorId}.`;
    case "wrong-actor":
      return `The previously selected session belongs to another actor. Select an active session for ${actorId}.`;
  }
}

/** Whether a rejection came from a stored value rather than an empty one. */
export function isStaleSelection(rejection: SessionRejection | null): boolean {
  return rejection === "missing" || rejection === "ended" || rejection === "wrong-actor";
}

/** Active sessions the given actor may select. */
export function selectableSessions(
  sessions: readonly Session[],
  actorId: string | null,
): Session[] {
  if (!actorId) return [];
  return sessions.filter(
    (session) => session.status === "active" && session.agent_id === actorId,
  );
}
