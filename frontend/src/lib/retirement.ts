/**
 * Whether an agent may be retired, and what the operator must be told (UI-30).
 *
 * Retirement is reversible and destroys nothing, but the word invites the
 * opposite reading, and two verified behaviours make the disclosure matter more
 * than the action:
 *
 *   - a retired agent keeps every task it was assigned, and can still be
 *     assigned more. That is the SEC-1 failure in one line — codex-security was
 *     retired, kept SEC-1, and the release sat behind an identity that could
 *     not act. Showing outstanding work before retiring is the single
 *     disclosure that would have prevented it;
 *   - the CLI refuses while sessions are active. The console does not
 *     reimplement that guard, it explains it before the operator commits.
 *
 * Two refusals are the console's own, because the CLI would permit them and
 * the operator would be stranded: retiring the actor you are acting as, and
 * retiring `local-operator`.
 *
 * Spec: docs/ux-retire-agent-spec.md sections 2 and 6.
 */

import type { Agent, Session, TaskListRow } from "../api/contract.ts";
import { describeAge, secondsSinceSeen } from "./staleness.ts";

/** Bootstrapped at startup; the console depends on it existing and active. */
export const PROTECTED_AGENT_ID = "local-operator";

export type RetirementBlock =
  | { kind: "self"; reason: string }
  | { kind: "protected"; reason: string }
  | { kind: "active-sessions"; reason: string; sessions: Session[] };

/** Active sessions belonging to an agent, newest-seen first. */
export function blockingSessions(
  sessions: readonly Session[],
  agentId: string,
): Session[] {
  return sessions
    .filter((session) => session.status === "active" && session.agent_id === agentId)
    .slice()
    .sort((a, b) => (a.last_seen_at < b.last_seen_at ? 1 : -1));
}

/**
 * Why retirement is unavailable, or null when it may proceed.
 *
 * Order matters. The console's own guards come first because they are absolute
 * — no amount of ending sessions makes retiring your own actor safe — and
 * reporting a session first would send the operator to end sessions for nothing.
 */
export function retirementBlock(
  agent: Pick<Agent, "id" | "name">,
  actingActorId: string | null,
  sessions: readonly Session[],
): RetirementBlock | null {
  if (agent.id === actingActorId) {
    return {
      kind: "self",
      reason:
        "You are acting as this agent. Switch to another actor to retire it — a " +
        "retired agent cannot start a session, so you could not undo it.",
    };
  }
  if (agent.id === PROTECTED_AGENT_ID) {
    return {
      kind: "protected",
      reason:
        `${PROTECTED_AGENT_ID} is created at startup and the console depends on it ` +
        "being active. Startup would recreate it and fight the change.",
    };
  }
  const blocking = blockingSessions(sessions, agent.id);
  if (blocking.length > 0) {
    const listed = blocking
      .map((session) => `${session.id} (last seen ${describeAge(secondsSinceSeen(session.last_seen_at))})`)
      .join(", ");
    return {
      kind: "active-sessions",
      sessions: blocking,
      reason:
        `${agent.name} has ${blocking.length} active session${blocking.length === 1 ? "" : "s"}: ` +
        `${listed}. A session must end before its agent can be retired. Sessions end ` +
        "when their agent stops, or through recovery from Health.",
    };
  }
  return null;
}

/**
 * Tasks the agent still holds, in id order.
 *
 * Retirement does not unassign them, which is the warning the confirmation
 * exists to give.
 */
export function outstandingAssignments(
  tasks: readonly TaskListRow[],
  agentId: string,
): TaskListRow[] {
  return tasks
    .filter((task) => task.assignees?.includes(agentId) && task.status !== "done")
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Operator-facing copy for the failures this call can return. */
export function retireErrorCopy(code: string, message: string, agent: Pick<Agent, "id" | "name">): string {
  switch (code) {
    case "agent_has_active_sessions":
      return `${agent.name} still has an active session. End it, or recover it from Health, then retire the agent.`;
    case "not_found":
      return `${agent.id} no longer exists. Refresh the agent list.`;
    case "inactive_actor":
      return "The actor you are acting as is retired and cannot make this change. Choose an active actor.";
    default:
      return message;
  }
}
