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
 * 3. neither: a stated absence.
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

/**
 * The cause cited with the most recent move into blocked, from a task's
 * status audit rows in any order. Null when the move cited none.
 */
export function blockingCause(entries: readonly AuditEntry[]): Because | null {
  const moves = entries
    .filter((entry) => entry.action === "status" && /-> blocked(;|$)/.test(entry.detail))
    .sort((a, b) => b.id - a.id);
  const latest = moves[0];
  return latest ? parseBecause(latest.detail).because : null;
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
