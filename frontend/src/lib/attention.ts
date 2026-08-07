/**
 * Which tasks are actionable now, by anyone.
 *
 * One definition, deliberately in one place. The queue's row treatment (UI-45)
 * and the home view's findings (UI-42) must tell one story: if they ever
 * disagree about what needs attention, that is a bug in this module and not a
 * difference of opinion between two surfaces.
 *
 * The operator settled the definition. Recorded here so it is not
 * re-litigated from taste:
 *
 *   - Not-done was rejected at 41% of the board. Two rows in five is close to
 *     highlighting nothing, because the eye stops distinguishing at that
 *     density.
 *   - Blocked-or-unowned alone was rejected at 2%. Precise, but silent about
 *     the tasks in review where someone owes a disposition, which is the most
 *     common real bottleneck here.
 *   - Assigned-to-the-acting-actor was rejected because on a single-operator
 *     console the operator is `local-operator` while agents own most tasks, so
 *     it would highlight almost nothing — and would hide work that is stuck
 *     precisely because nobody owns it.
 *
 * The chosen set lands near 13%.
 */

import type { TaskListRow } from "../api/contract.ts";

export type AttentionReason = "blocked" | "unowned" | "stale-claim" | "awaiting-review";

export interface AttentionContext {
  /**
   * Sessions the CLI would consider recoverable.
   *
   * Optional because the queue can be useful before sessions load. When it is
   * absent the stale-claim clause simply does not fire — the row is quieter
   * than it should be, never louder, and never wrong about the other three.
   */
  staleSessionIds?: ReadonlySet<string>;
}

/**
 * Why this task needs attention, or null if it does not.
 *
 * Returns the reason rather than a boolean so a caller can explain the
 * highlight. A row that says only "this matters" and cannot say why is the
 * decorative treatment this replaces.
 */
export function attentionReason(
  task: Pick<TaskListRow, "status" | "assignees" | "claim_session_id">,
  context: AttentionContext = {},
): AttentionReason | null {
  // Done is never actionable, and checking it first keeps every clause below
  // from having to repeat the exclusion.
  if (task.status === "done") return null;

  if (task.status === "blocked") return "blocked";
  if (task.assignees.length === 0) return "unowned";

  const claim = task.claim_session_id;
  if (claim && context.staleSessionIds?.has(claim)) return "stale-claim";

  // Review is where work waits on a person rather than on work.
  if (task.status === "review") return "awaiting-review";

  return null;
}

export function needsAttention(
  task: Pick<TaskListRow, "status" | "assignees" | "claim_session_id">,
  context: AttentionContext = {},
): boolean {
  return attentionReason(task, context) !== null;
}

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  blocked: "Blocked",
  unowned: "Nobody owns this",
  "stale-claim": "Claimed by a stale session",
  "awaiting-review": "Waiting on a review decision",
};

/** How many of `tasks` need attention — the number the home view reports. */
export function attentionCount(
  tasks: readonly Pick<TaskListRow, "status" | "assignees" | "claim_session_id">[],
  context: AttentionContext = {},
): number {
  return tasks.reduce((total, task) => total + (needsAttention(task, context) ? 1 : 0), 0);
}
