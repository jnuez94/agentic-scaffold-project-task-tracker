/**
 * Why a task is blocked, from what actually blocks it (UI-83).
 *
 * "Why this is blocked" used to read `blocked_claims` first. That field is
 * the "Does not authorize" boundary, so on the release task the reason read
 * "This task does not authorize release…" — a boundary, not a reason. The
 * reason is now built from the records that say why:
 *
 * 1. the task's active `blocks` dependencies, each with that task's status;
 * 2. the cause cited when it was moved into blocked — `because=TYPE:ID` in
 *    the status audit detail, the one structured reason a move carries. The
 *    CLI writes a status note into the task's notes field, replacing what was
 *    there, not into the audit detail, so the note itself is not in the
 *    history and is not read here;
 * 3. session recovery: when a claim's session is recovered, the CLI moves the
 *    task into blocked as a `recover_claim` row, not a `status` row. That
 *    move starts a new blocked episode, so a cause cited on an earlier move is
 *    not carried across it; the recovery and its reason are shown instead;
 * 4. none of these: a stated absence.
 *
 * `blocked_claims` and `notes` are never the reason. Both keep their own
 * places on the Overview, shown in full.
 */

import type { AuditEntry, Dependency, TaskListRow } from "../api/contract.ts";
import { parseBecause, type Because } from "./because.ts";
import { taskStatus } from "./labels.ts";

export const NO_RECORDED_REASON = "No reason was recorded when this was blocked.";

/** The ids this task waits on: its own active `blocks` edges, in the order recorded. */
export function blockingTaskIds(taskId: string, dependencies: readonly Dependency[]): string[] {
  return dependencies
    .filter(
      (edge) => edge.task_id === taskId && edge.dependency_type === "blocks" && edge.status === "active",
    )
    .map((edge) => edge.depends_on_task_id);
}

const INTO_BLOCKED = /-> blocked(;|$)/;

/** Actions that can move a task into blocked: a status change, or session recovery. */
export const BLOCKING_ACTIONS = ["status", "recover_claim"] as const;

/** The most recent move into blocked, from a task's audit rows in any order. */
function latestBlockingMove(entries: readonly AuditEntry[]): AuditEntry | undefined {
  return entries
    .filter(
      (entry) =>
        (BLOCKING_ACTIONS as readonly string[]).includes(entry.action) && INTO_BLOCKED.test(entry.detail),
    )
    .reduce<AuditEntry | undefined>((latest, entry) => (!latest || entry.id > latest.id ? entry : latest), undefined);
}

/**
 * The cause cited with the most recent move into blocked. Null when that move
 * cited none, including when it was a session recovery.
 */
export function blockingCause(entries: readonly AuditEntry[]): Because | null {
  const latest = latestBlockingMove(entries);
  return latest?.action === "status" ? parseBecause(latest.detail).because : null;
}

export interface Recovery {
  /** The recovered session, when the row names it. */
  session: string | null;
  /** The reason given for the recovery, or "" when none was. */
  reason: string;
}

/**
 * When the most recent move into blocked was a session recovery, what it
 * recorded. The CLI writes `session ID; old -> blocked; revision a -> b; REASON`.
 */
export function blockingRecovery(entries: readonly AuditEntry[]): Recovery | null {
  const latest = latestBlockingMove(entries);
  if (latest?.action !== "recover_claim") return null;
  const parts = latest.detail.split("; ");
  const session = /^session (\S+)$/.exec(parts[0] ?? "")?.[1] ?? latest.session_id ?? null;
  const revision = parts.findIndex((part) => part.startsWith("revision "));
  const reason = revision >= 0 ? parts.slice(revision + 1).join("; ").trim() : "";
  return { session, reason };
}

export interface WaitsOn {
  id: string;
  /** "to do", "in review"… or null when the task was not returned. */
  status: string | null;
}

/** Pairs each blocking id with its task's status, as the operator reads it. */
export function waitsOn(ids: readonly string[], tasks: readonly Pick<TaskListRow, "id" | "status">[]): WaitsOn[] {
  const byId = new Map(tasks.map((task) => [task.id, task.status]));
  return ids.map((id) => {
    const status = byId.get(id);
    return { id, status: status ? taskStatus(status).label.toLowerCase() : null };
  });
}
