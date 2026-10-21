/**
 * Answering an escalation from the console (UI-82): what can be answered, what
 * a resolution needs, and what is sent.
 *
 * An escalation is answered once. `if_status` is the status the row was
 * loaded with, so one answered elsewhere in the meantime is refused as
 * status_mismatch rather than answered twice — the CLI would otherwise accept
 * a second resolve and overwrite the first.
 */

import type { Escalation } from "../api/contract.ts";
import { receiptSuffix } from "./receipt.ts";
import { splitIds } from "./artifactActions.ts";

export type ResolutionOutcome = "resolved" | "closed_no_action";

export const RESOLUTION_OUTCOMES: readonly { value: ResolutionOutcome; label: string }[] = [
  { value: "resolved", label: "Resolved" },
  { value: "closed_no_action", label: "Closed, no action" },
];

export interface ResolutionDraft {
  outcome: ResolutionOutcome;
  resolution: string;
  followUps: string;
  /** `TYPE:ID`, or "" for none. */
  because: string;
}

export const emptyResolution = (): ResolutionDraft => ({
  outcome: "resolved",
  resolution: "",
  followUps: "",
  because: "",
});

/** Only an escalation still waiting on an answer can be answered. */
export function isResolvable(escalation: Pick<Escalation, "status">): boolean {
  return escalation.status === "open" || escalation.status === "in_review";
}

/** Why the draft cannot be sent yet, or null. Follow-ups must be tasks on this board. */
export function resolutionBlockedReason(draft: ResolutionDraft, knownTaskIds: readonly string[]): string | null {
  if (!draft.resolution.trim()) return "Write the resolution: what was decided and by whom.";
  const known = new Set(knownTaskIds);
  const unknown = splitIds(draft.followUps).filter((id) => !known.has(id));
  if (unknown.length) return `${unknown.join(", ")} ${unknown.length === 1 ? "is not a task" : "are not tasks"} on this board.`;
  return null;
}

/**
 * One line when the actor answering is not the escalation's owner. It never
 * blocks: an owner can be a role or a person outside the database, and the
 * record names whoever resolved it.
 */
export function ownerNote(escalation: Pick<Escalation, "owner">, actorId: string | null): string | null {
  if (!actorId || escalation.owner.trim() === actorId) return null;
  return `You are not this escalation's owner (${escalation.owner}). The record will name you as the resolver.`;
}

export function buildResolutionRequest(
  escalation: Pick<Escalation, "status">,
  draft: ResolutionDraft,
  actorId: string,
): Record<string, string> {
  const request: Record<string, string> = {
    actor: actorId,
    status: draft.outcome,
    resolution: draft.resolution.trim(),
    if_status: escalation.status,
  };
  const followUps = splitIds(draft.followUps);
  if (followUps.length) request["follow_up_tasks"] = followUps.join(", ");
  if (draft.because) request["because"] = draft.because;
  return request;
}

export function resolutionAnnouncement(id: string, outcome: ResolutionOutcome, result: unknown): string {
  const what = outcome === "resolved" ? "resolved" : "closed with no action";
  return `${id} ${what}.${receiptSuffix(result)}`;
}
