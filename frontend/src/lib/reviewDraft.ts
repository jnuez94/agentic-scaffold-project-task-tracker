/**
 * Recording a review from the console (UI-52): the draft, its checks, and the
 * two fields the ruling makes mandatory.
 *
 * The bar's test is whether the interface already implies the action exists,
 * and after UI-45 it does loudly: awaiting-review is the dominant attention
 * category, so the console marks rows as owing a disposition. The quality
 * concern — that a web form invites thin reviews — is answered by shaping the
 * form rather than withholding it: `required_changes` and `blocked_claims`
 * are MANDATORY here. A disposition cannot be recorded without stating what
 * it asks for and what it does not approve, which is what makes a review
 * worth reading, and a form can enforce what a hurried CLI invocation omits.
 */

import type { ReviewDecision, TaskDetail } from "../api/contract.ts";
import { ESCALATION_ID_SHAPE, isValidRecordId, nextFreeId } from "./recordIds.ts";

export interface ReviewDraft {
  id: string;
  decision: ReviewDecision;
  artifact: string;
  scope: string;
  acceptedItems: string;
  requiredChanges: string;
  risks: string;
  blockedClaims: string;
  followUpTasks: string;
}

export const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  "accepted",
  "conditionally_accepted",
  "changes_requested",
  "rejected",
];

export const DECISION_LABELS: Record<ReviewDecision, string> = {
  accepted: "Accepted",
  conditionally_accepted: "Conditionally accepted",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

/** What the disposition means for the task, stated with the announcement. */
export const DECISION_CONSEQUENCE: Record<ReviewDecision, string> = {
  accepted: "The task can leave review.",
  conditionally_accepted: "The task can leave review once the required changes land.",
  changes_requested: "The task stays in review until the required changes land.",
  rejected: "The task does not leave review on this work.",
};

/**
 * A first guess at an id in the board's descriptive convention, with the
 * number last: REVIEW-UI42-1. Overridable; the CLI decides uniqueness.
 */
export function suggestReviewId(taskId: string | null, ids: readonly string[]): string {
  const prefix = taskId ? `REVIEW-${taskId.replace(/-/g, "")}` : "REVIEW";
  return nextFreeId(prefix, ids, ESCALATION_ID_SHAPE);
}

/**
 * The artifact a review of this task is most likely about: its latest
 * evidence. A starting point, not a claim — the field stays editable and is
 * required, so an empty prefill is refused rather than guessed.
 */
export function latestEvidenceUri(detail: Pick<TaskDetail, "evidence">): string {
  const last = detail.evidence[detail.evidence.length - 1];
  return last?.uri ?? "";
}

export function emptyReview(detail: Pick<TaskDetail, "id" | "evidence">, ids: readonly string[]): ReviewDraft {
  return {
    id: suggestReviewId(detail.id, ids),
    decision: "accepted",
    artifact: latestEvidenceUri(detail),
    scope: "",
    acceptedItems: "",
    requiredChanges: "",
    risks: "",
    blockedClaims: "",
    followUpTasks: "",
  };
}

export interface ReviewProblem {
  field: "id" | "artifact" | "scope" | "requiredChanges" | "blockedClaims" | "actor";
  message: string;
}

export function checkReviewDraft(
  draft: ReviewDraft,
  context: { actorId: string | null; existingIds: readonly string[] },
): ReviewProblem | null {
  if (!context.actorId) {
    return { field: "actor", message: "Select an actor in the header: a review records who gave it." };
  }
  const id = draft.id.trim();
  if (!id) return { field: "id", message: "Give the review an id." };
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
  if (!draft.artifact.trim()) {
    return { field: "artifact", message: "Name what was reviewed — a commit, a path, a capture." };
  }
  if (!draft.scope.trim()) return { field: "scope", message: "State the scope of this review." };
  // The two the ruling makes mandatory. Accepted reviews included: an
  // acceptance that cannot say what it does not authorize is not one.
  if (!draft.requiredChanges.trim()) {
    return {
      field: "requiredChanges",
      message: "State what this review asks for. If nothing, say so in words — 'none' is a statement.",
    };
  }
  if (!draft.blockedClaims.trim()) {
    return {
      field: "blockedClaims",
      message: "State what this review does not authorize. Every acceptance has a boundary.",
    };
  }
  return null;
}

export function isDuplicateReviewId(code: string, details: unknown): boolean {
  if (code !== "constraint_violation") return false;
  const text =
    typeof details === "string"
      ? details
      : details && typeof details === "object"
        ? JSON.stringify(details)
        : "";
  return text.includes("reviews.id");
}

/** The POST /api/reviews body. */
export function buildReviewRequest(
  draft: ReviewDraft,
  taskId: string,
  actorId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: draft.id.trim(),
    task: taskId,
    reviewer: actorId,
    artifact: draft.artifact.trim(),
    scope: draft.scope.trim(),
    decision: draft.decision,
    required_changes: draft.requiredChanges.trim(),
    blocked_claims: draft.blockedClaims.trim(),
  };
  if (draft.acceptedItems.trim()) body["accepted_items"] = draft.acceptedItems.trim();
  if (draft.risks.trim()) body["risks"] = draft.risks.trim();
  if (draft.followUpTasks.trim()) body["follow_up_tasks"] = draft.followUpTasks.trim();
  return body;
}
