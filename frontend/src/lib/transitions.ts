/**
 * Which actions a task actually offers right now.
 *
 * The rules come from docs/cli-contract.md, "Allowed status transitions", plus
 * three constraints the transition table alone does not express:
 *
 *   - `in_progress` is reachable only through `task claim`;
 *   - leaving `in_progress` requires the acting actor *and* session to own the
 *     claim;
 *   - `done` requires at least one evidence row.
 *
 * Computing this up front is what lets the inspector show only valid actions
 * with an explanation, instead of offering a button that fails on submit.
 */

import type { TaskListRow, TaskStatus } from "../api/contract.ts";

export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "blocked"],
  in_progress: ["todo", "review", "blocked"],
  review: ["in_progress", "blocked", "done"],
  blocked: ["todo", "in_progress"],
  done: [],
};

export type ActionKind = "claim" | "status" | "release";

export interface TaskAction {
  kind: ActionKind;
  target: TaskStatus;
  label: string;
  primary: boolean;
  /** When set, the action is shown disabled with this as the explanation. */
  blockedReason?: string;
}

export interface ActionContext {
  actorId: string | null;
  sessionId: string | null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Release to todo",
  in_progress: "Claim task",
  review: "Submit for review",
  blocked: "Mark blocked",
  done: "Mark done",
};

export function availableActions(task: TaskListRow, context: ActionContext): TaskAction[] {
  const targets = TRANSITIONS[task.status] ?? [];
  return targets.map((target) => buildAction(task, target, context));
}

function buildAction(
  task: TaskListRow,
  target: TaskStatus,
  context: ActionContext,
): TaskAction {
  const label = STATUS_LABELS[target];

  if (target === "in_progress") {
    return {
      kind: "claim",
      target,
      label,
      primary: true,
      blockedReason: claimBlockedReason(task, context),
    };
  }

  const leavingInProgress = task.status === "in_progress";
  const action: TaskAction = {
    kind: leavingInProgress ? "release" : "status",
    target,
    label,
    primary: target === "review" || target === "done",
  };

  const reason = leavingInProgress
    ? ownedClaimBlockedReason(task, context)
    : missingActorReason(context);
  const evidenceReason = target === "done" && task.evidence_count === 0
    ? "Evidence required before completion. Add evidence on the Evidence tab."
    : undefined;

  const blocked = reason ?? evidenceReason;
  if (blocked) action.blockedReason = blocked;
  return action;
}

function missingActorReason(context: ActionContext): string | undefined {
  if (!context.actorId) return "Select an actor before changing this task.";
  return undefined;
}

function claimBlockedReason(task: TaskListRow, context: ActionContext): string | undefined {
  if (!context.actorId) return "Select an actor before claiming.";
  if (!context.sessionId) return "Claiming requires an active session. Start or select one.";
  if (task.claimed_by && task.claimed_by !== context.actorId) {
    return `Claimed by ${task.claimed_by} in session ${task.claim_session_id ?? "unknown"}.`;
  }
  return undefined;
}

function ownedClaimBlockedReason(
  task: TaskListRow,
  context: ActionContext,
): string | undefined {
  const missing = missingActorReason(context);
  if (missing) return missing;
  if (!context.sessionId) return "Leaving in progress requires the session that holds the claim.";
  if (task.claimed_by && task.claimed_by !== context.actorId) {
    return `Only ${task.claimed_by} can move this task out of in progress.`;
  }
  if (task.claim_session_id && task.claim_session_id !== context.sessionId) {
    return `The claim belongs to session ${task.claim_session_id}. Select that session.`;
  }
  return undefined;
}
