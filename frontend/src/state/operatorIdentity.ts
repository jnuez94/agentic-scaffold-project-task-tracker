/**
 * Decision logic for the automatic local-operator bootstrap.
 *
 * Contract: ux-data-shape-and-workflow-spec.md section 2.4 and decision
 * UX-IDENTITY-1.
 *
 * Pure functions, deliberately: the rules that decide whether to create an
 * identity, reuse one, or refuse are the part worth testing exhaustively, and
 * they should be readable without following a network sequence.
 */

import type { Agent, Session } from "../api/contract.ts";

export const LOCAL_OPERATOR = {
  id: "local-operator",
  name: "Local Operator",
  role: "Human Operator",
  actor_type: "human",
} as const;

/** Identifies sessions this console started, so it can reuse its own. */
export const CONSOLE_HARNESS = "coordination-console";

export type OperatorCheck =
  | { kind: "missing" }
  | { kind: "ready"; agent: Agent }
  | { kind: "conflict"; reason: string };

/**
 * Decide what startup should do about the `local-operator` record.
 *
 * A mismatch is never repaired automatically. These fields carry
 * accountability, and silently rewriting an actor_type or reactivating a
 * deactivated identity would forge an audit trail.
 */
export function evaluateOperator(agents: readonly Agent[]): OperatorCheck {
  const existing = agents.find((agent) => agent.id === LOCAL_OPERATOR.id);
  if (!existing) return { kind: "missing" };

  if (existing.actor_type !== LOCAL_OPERATOR.actor_type) {
    return {
      kind: "conflict",
      reason:
        `An actor named ${LOCAL_OPERATOR.id} already exists with actor_type ` +
        `"${existing.actor_type}", not "${LOCAL_OPERATOR.actor_type}". ` +
        "Startup will not rewrite an existing identity's actor type.",
    };
  }

  if (existing.status !== "active") {
    return {
      kind: "conflict",
      reason:
        `The actor ${LOCAL_OPERATOR.id} exists but is inactive. Reactivating it ` +
        "requires a different active actor, so startup cannot do it safely. " +
        "Reactivate it with the coordination CLI, then reload.",
    };
  }

  return { kind: "ready", agent: existing };
}

/**
 * Find an active session this console can adopt.
 *
 * Reusing beats creating: browser shutdown is not reliable, so starting a
 * session per launch would grow `agent_sessions` without bound. When several
 * match, the most recently seen one wins.
 */
export function findReusableSession(
  sessions: readonly Session[],
  agentId: string,
  harness: string = CONSOLE_HARNESS,
): Session | null {
  const candidates = sessions.filter(
    (session) =>
      session.status === "active" &&
      session.agent_id === agentId &&
      session.harness === harness,
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) =>
    a.last_seen_at === b.last_seen_at
      ? a.id.localeCompare(b.id)
      : a.last_seen_at < b.last_seen_at
        ? 1
        : -1,
  )[0] as Session;
}

/**
 * A session id that satisfies the contract's identifier grammar: leading
 * alphanumeric, then letters, digits, and `.\_:@+-` only.
 */
export function newSessionId(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `console-${stamp}`;
}

/** The payload used to create the operator through the CLI-backed API. */
export function createOperatorRequest(): Record<string, string> {
  return {
    id: LOCAL_OPERATOR.id,
    name: LOCAL_OPERATOR.name,
    role: LOCAL_OPERATOR.role,
    actor_type: LOCAL_OPERATOR.actor_type,
    goal: "Coordinate local work through the console.",
    responsibilities:
      "Accountable local operator for mutations performed from this console.",
  };
}
