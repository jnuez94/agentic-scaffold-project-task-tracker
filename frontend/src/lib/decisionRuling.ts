/**
 * Changing a decision's status from the console (UI-73).
 *
 * The CLI makes the note optional; the console does not. A status change on a
 * governance record without a reason is not a governance record, so the form
 * refuses to submit without one. `--if-status` is always the status the row
 * was loaded with, so a decision that changed underneath the operator is
 * refused with status_mismatch rather than silently overwritten.
 */

import type { Decision, DecisionStatus } from "../api/contract.ts";
import { receiptSuffix } from "./receipt.ts";

export const DECISION_STATUSES: readonly DecisionStatus[] = [
  "proposed",
  "accepted",
  "superseded",
  "rejected",
];

/** What each ruling means for the record, said before the operator commits. */
export const RULING_CONSEQUENCE: Record<DecisionStatus, string> = {
  proposed: "The decision is open again; it binds nobody until accepted.",
  accepted: "The decision is in force and the board acts on it.",
  superseded: "The decision no longer applies; whatever replaced it should be named in the note.",
  rejected: "The decision is refused and does not take effect.",
};

export interface RulingDraft {
  status: DecisionStatus | "";
  note: string;
}

export function rulingBlockedReason(decision: Decision, draft: RulingDraft): string | null {
  if (!draft.status) return "Choose the status this decision moves to.";
  if (draft.status === decision.status) return `It is already ${decision.status}.`;
  if (!draft.note.trim()) return "Say why. A status change without a reason is not a governance record.";
  return null;
}

export function buildRulingRequest(
  decision: Decision,
  draft: RulingDraft,
  actorId: string,
): Record<string, unknown> {
  return {
    status: draft.status,
    actor: actorId,
    if_status: decision.status,
    note: draft.note.trim(),
  };
}

export interface RulingResult {
  id: string;
  previous_status: string;
  status: string;
}

export function rulingAnnouncement(result: RulingResult): string {
  return `${result.id} is now ${result.status}, was ${result.previous_status}.${receiptSuffix(result)}`;
}
