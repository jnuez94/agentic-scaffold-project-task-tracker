/**
 * Raising an escalation (UI-49): the draft, its checks, and the prefill.
 *
 * One form, two entry points. The task inspector is the primary, because the
 * operator is already looking at the thing that is stuck. Health's blocked-
 * tasks row links into the same form pre-filled with the task and its blocking
 * reason, because someone who has just read why something is blocked should
 * not retype it.
 *
 * `owner` is a select of ACTIVE agents only, by ruling, even though the CLI
 * accepts free text: an escalation owned by a retired identity is the SEC-1
 * failure repeating. `raised_by` is the acting actor and read-only.
 */

import type { Task } from "../api/contract.ts";
import {
  ESCALATION_ID_SHAPE,
  isValidRecordId,
  nextFreeId,
  prefixesInUse,
} from "./recordIds.ts";

export interface EscalationDraft {
  id: string;
  owner: string;
  relatedTasks: string;
  neededBy: string;
  issue: string;
  requestedDecision: string;
}

/**
 * Why a task is blocked, as the inspector shows it: the authority boundary
 * first, the notes otherwise. One definition, shared with TaskOverview, so the
 * sentence Health quotes into an escalation is the sentence the inspector
 * displays.
 */
export function blockingReason(task: Pick<Task, "blocked_claims" | "notes">): string {
  return task.blocked_claims?.trim() || task.notes?.trim() || "";
}

/** Escalation prefixes on this board, most-used first. */
export function escalationPrefixes(ids: readonly string[]) {
  return prefixesInUse(ids, ESCALATION_ID_SHAPE);
}

/**
 * A first guess at an id, following the board's own convention where there is
 * one: ESC-<TASK>-1 for an escalation about a task, or the next free ESC-N.
 * Overridable; the CLI decides uniqueness.
 */
export function suggestEscalationId(relatedTask: string | null, ids: readonly string[]): string {
  const prefix = relatedTask ? `ESC-${relatedTask.replace(/-/g, "")}` : "ESC";
  return nextFreeId(prefix, ids, ESCALATION_ID_SHAPE);
}

export function emptyEscalation(relatedTask: string | null, issue: string, ids: readonly string[]): EscalationDraft {
  return {
    id: suggestEscalationId(relatedTask, ids),
    owner: "",
    relatedTasks: relatedTask ?? "",
    neededBy: "",
    issue,
    requestedDecision: "",
  };
}

export interface EscalationProblem {
  field: "id" | "owner" | "issue" | "requestedDecision" | "actor";
  message: string;
}

export function checkEscalationDraft(
  draft: EscalationDraft,
  context: { actorId: string | null; existingIds: readonly string[] },
): EscalationProblem | null {
  if (!context.actorId) {
    return { field: "actor", message: "Select an actor in the header: an escalation records who raised it." };
  }
  const id = draft.id.trim();
  if (!id) return { field: "id", message: "Give the escalation an id." };
  if (!isValidRecordId(id)) {
    return {
      field: "id",
      message:
        "Ids start with a letter or digit and may contain letters, digits, and . _ : @ + - only.",
    };
  }
  if (context.existingIds.includes(id)) {
    return { field: "id", message: `${id} already exists. Choose another id.` };
  }
  if (!draft.owner) return { field: "owner", message: "Name who has the authority to decide." };
  if (!draft.issue.trim()) return { field: "issue", message: "Say what is stuck." };
  if (!draft.requestedDecision.trim()) {
    return { field: "requestedDecision", message: "Say what decision you are asking for." };
  }
  return null;
}

export function isDuplicateEscalationId(code: string, details: unknown): boolean {
  if (code !== "constraint_violation") return false;
  const text =
    typeof details === "string"
      ? details
      : details && typeof details === "object"
        ? JSON.stringify(details)
        : "";
  return text.includes("escalations.id");
}

/** The POST /api/escalations body. */
export function buildEscalationRequest(
  draft: EscalationDraft,
  actorId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: draft.id.trim(),
    raised_by: actorId,
    owner: draft.owner,
    issue: draft.issue.trim(),
    requested_decision: draft.requestedDecision.trim(),
  };
  if (draft.relatedTasks.trim()) body["related_tasks"] = draft.relatedTasks.trim();
  if (draft.neededBy.trim()) body["needed_by"] = draft.neededBy.trim();
  return body;
}
