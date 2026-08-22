/**
 * Filing a task from the console (UI-48): the id, the draft, and the checks.
 *
 * The id is the field that matters most and is treated accordingly. It is the
 * only field with no correction path — there is no rename — so it goes first,
 * where attention is highest, and it is pre-filled with the next free number
 * for a prefix already in use rather than left blank. Pre-filled, not fixed:
 * the operator can type any id the schema accepts.
 *
 * "Next free" is computed from the loaded window, which is honest up to the
 * request limit and could be stale past it or under a concurrent create. That
 * is why the duplicate-id refusal path exists and keeps the draft: the CLI is
 * the authority on uniqueness, and the console's job is to make its refusal
 * recoverable rather than to pretend it cannot happen.
 */

export interface TaskDraft {
  id: string;
  title: string;
  assignee: string;
  description: string;
  priority: number;
  tags: string;
  acceptance: string;
  nextSteps: string;
  blockedClaims: string;
}

export const EMPTY_DRAFT: Omit<TaskDraft, "id"> = {
  title: "",
  assignee: "",
  description: "",
  priority: 3,
  tags: "",
  acceptance: "",
  nextSteps: "",
  blockedClaims: "",
};

/** The CLI accepts 1 through 5; 3 is its own default. */
export const PRIORITIES = [1, 2, 3, 4, 5] as const;

import {
  isValidRecordId,
  nextFreeId as nextFreeIdBy,
  prefixesInUse as prefixesInUseBy,
  prefixOf as prefixOfBy,
  TASK_ID_SHAPE,
} from "./recordIds.ts";

// The id helpers are shared with the escalation form; see recordIds.ts for
// why the shape is a parameter. Re-exported here bound to the task shape so
// callers of this module see one vocabulary.
export const isValidTaskId = isValidRecordId;
export const prefixesInUse = (ids: readonly string[]) => prefixesInUseBy(ids, TASK_ID_SHAPE);
export const nextFreeId = (prefix: string, ids: readonly string[]) =>
  nextFreeIdBy(prefix, ids, TASK_ID_SHAPE);
export const prefixOf = (id: string) => prefixOfBy(id, TASK_ID_SHAPE);

export interface DraftProblem {
  field: "id" | "title" | "actor";
  message: string;
}

/** The first thing wrong with a draft, or null. Checked before any request. */
export function checkTaskDraft(
  draft: TaskDraft,
  context: { actorId: string | null; existingIds: readonly string[] },
): DraftProblem | null {
  if (!context.actorId) {
    return { field: "actor", message: "Select an actor in the header: a task records who filed it." };
  }
  const id = draft.id.trim();
  if (!id) return { field: "id", message: "Give the task an id." };
  if (!isValidTaskId(id)) {
    return {
      field: "id",
      message:
        "Ids start with a letter or digit and may contain letters, digits, and . _ : @ + - only.",
    };
  }
  if (context.existingIds.includes(id)) {
    return { field: "id", message: duplicateIdCopy(id, context.existingIds) };
  }
  if (!draft.title.trim()) return { field: "title", message: "Give the task a title." };
  return null;
}

/**
 * The refusal for an id that exists — and the way out. Offering the next free
 * number is the ruling: reporting the clash alone leaves the operator to work
 * it out, which is exactly what pre-filling was meant to spare them.
 */
export function duplicateIdCopy(id: string, existingIds: readonly string[]): string {
  const prefix = prefixOf(id);
  const suggestion = prefix ? ` Next free is ${nextFreeId(prefix, existingIds)}.` : "";
  return `${id} already exists.${suggestion}`;
}

/** Whether a CLI refusal is the duplicate-id case, which keeps the draft. */
export function isDuplicateId(code: string, details: unknown): boolean {
  if (code !== "constraint_violation") return false;
  // Narrowed explicitly rather than String()-ed: `details` is unknown, and an
  // object would stringify to "[object Object]" and silently never match.
  const text =
    typeof details === "string"
      ? details
      : details && typeof details === "object"
        ? JSON.stringify(details)
        : "";
  return text.includes("tasks.id");
}

/** The POST /api/tasks body. Empty optional fields are omitted, not sent blank. */
export function buildCreateRequest(
  draft: TaskDraft,
  actorId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: draft.id.trim(),
    title: draft.title.trim(),
    actor: actorId,
    priority: draft.priority,
  };
  if (draft.description.trim()) body["description"] = draft.description.trim();
  if (draft.tags.trim()) body["tags"] = draft.tags.trim();
  if (draft.acceptance.trim()) body["acceptance"] = draft.acceptance.trim();
  if (draft.nextSteps.trim()) body["next_steps"] = draft.nextSteps.trim();
  if (draft.blockedClaims.trim()) body["blocked_claims"] = draft.blockedClaims.trim();
  if (draft.assignee) body["assignees"] = [draft.assignee];
  return body;
}
