/**
 * Planning an assignee change before committing it (UI-28).
 *
 * Reassignment is a multi-step edit committed in a single call, so the rules
 * about what is legal have to be answerable before submission rather than
 * discovered from a refusal. Three of the CLI's verified behaviours drive this:
 *
 *   - assigning a retired agent is *allowed* by the CLI, and is exactly how
 *     SEC-1 came to be owned by a deactivated identity;
 *   - removing the active claim owner is refused, but assignee and claim owner
 *     are shown in different places, so the operator cannot predict it;
 *   - removing every assignee is allowed and silently manufactures an
 *     `unowned_tasks` health finding.
 *
 * Kept pure and separate from the panel: these are the rules worth testing
 * exhaustively, and they read badly when tangled with form state.
 *
 * Spec: .documents/ux-reassign-work-spec.md sections 5 and 6.
 */

import type { Agent, TaskDetail, TaskListRow } from "../api/contract.ts";
import { isSelectableActor } from "./labels.ts";

/**
 * The parts of a task assignment actually needs.
 *
 * Narrowed deliberately rather than taking TaskDetail. The queue row and the
 * inspector detail both carry these four fields, so typing against the subset
 * is what lets one editor serve both entry points instead of two that drift.
 * It also documents the real requirement: my own spec claimed the row lacked
 * the revision and claim state and could not offer assignment, which was
 * simply wrong.
 */
export type AssignableTask = Pick<
  TaskDetail,
  "id" | "assignees" | "claimed_by" | "revision"
>;

/** Both shapes satisfy it; this fails to compile if either stops doing so. */
const _detailIsAssignable: (t: TaskDetail) => AssignableTask = (t) => t;
const _rowIsAssignable: (t: TaskListRow) => AssignableTask = (t) => t;
void _detailIsAssignable;
void _rowIsAssignable;

export interface AssignmentDraft {
  /** Agent ids staged for addition, in selection order. */
  add: readonly string[];
  /** Agent ids staged for removal. */
  remove: readonly string[];
}

export const EMPTY_DRAFT: AssignmentDraft = { add: [], remove: [] };

/**
 * Why an assignee cannot be removed, or null when they can.
 *
 * Only one reason exists today, and it is a precondition rather than a
 * validation: the CLI enforces it independently, and this exists so the
 * operator is not made to discover it by failing.
 */
export function removalBlockedReason(task: AssignableTask, agentId: string): string | null {
  if (task.claimed_by && task.claimed_by === agentId) {
    return (
      `${agentId} holds the active claim on this task. Releasing or recovering ` +
      `the claim comes first — reassigning cannot take work away from a session ` +
      `that is still holding it.`
    );
  }
  return null;
}

/**
 * The agents offered in the add picker.
 *
 * Already-assigned agents are omitted, which is what makes the CLI's
 * add-and-remove-the-same-actor refusal unreachable rather than a message the
 * operator has to read. Retired agents are returned separately so the panel can
 * show them disabled: the console declines to make the SEC-1 failure mode easy,
 * while leaving it available to anyone who genuinely needs it via the CLI.
 */
export function addCandidates(
  agents: readonly Agent[],
  task: AssignableTask,
  draft: AssignmentDraft,
): { selectable: Agent[]; retired: Agent[] } {
  const already = new Set([...task.assignees, ...draft.add]);
  const offered = agents.filter((agent) => !already.has(agent.id));
  return {
    selectable: offered.filter(isSelectableActor),
    retired: offered.filter((agent) => !isSelectableActor(agent)),
  };
}

/** The assignee set that submitting this draft would produce, in id order. */
export function resultingAssignees(task: AssignableTask, draft: AssignmentDraft): string[] {
  const removing = new Set(draft.remove);
  const kept = task.assignees.filter((id) => !removing.has(id));
  return [...new Set([...kept, ...draft.add])].sort((a, b) => a.localeCompare(b));
}

/** Whether there is anything to submit. */
export function hasPendingChange(draft: AssignmentDraft): boolean {
  return draft.add.length > 0 || draft.remove.length > 0;
}

/**
 * Whether submitting would leave the task with no assignees.
 *
 * Not a blocker — deliberately unassigning is legitimate, and has been used to
 * release tasks for an incoming agent to claim explicitly. But it creates a
 * Health finding, and the console should say what it is about to create.
 */
export function wouldLeaveUnowned(task: AssignableTask, draft: AssignmentDraft): boolean {
  return hasPendingChange(draft) && resultingAssignees(task, draft).length === 0;
}

/** The single request body; add and remove always travel together. */
export function buildAssignRequest(
  task: AssignableTask,
  draft: AssignmentDraft,
  actorId: string,
): Record<string, unknown> {
  const request: Record<string, unknown> = { actor: actorId, if_revision: task.revision };
  if (draft.add.length) request["add"] = [...draft.add];
  if (draft.remove.length) request["remove"] = [...draft.remove];
  return request;
}

/**
 * Operator-facing copy for the failures this call can return.
 *
 * Branches on `error.code` only. The contract is explicit that codes are the
 * stable surface and messages are not.
 */
export function assignErrorCopy(code: string, message: string, subject?: string): string {
  switch (code) {
    case "task_claim_owner_mismatch":
      return (
        `${subject ?? "That assignee"} holds the active claim and cannot be removed. ` +
        "Release the claim or recover the session that holds it, then try again."
      );
    case "stale_task_revision":
      return "This task changed while you were editing. Reload latest; your draft will be preserved.";
    case "not_found":
      return `${subject ?? "That agent"} no longer exists as an agent. Refresh the agent list.`;
    default:
      // Reachable only if the panel let through something it should have
      // prevented, so show what the CLI actually said rather than paraphrasing.
      return message;
  }
}
