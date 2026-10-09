/**
 * Registering, ruling on, and correcting artifacts (UI-54).
 *
 * Three CLI commands, three forms, one module deciding what each sends.
 * `artifact update` (1.3.0) corrects a record in place — URIs are paths and
 * paths move — so only the fields that changed are sent, at least one must
 * have, and `--if-status` is the status the row was loaded with. Status,
 * owner, related tasks and reviewers are not the update's to change and are
 * never sent by it. Paths are edited one per line and stored as the CLI's own
 * comma-separated field.
 */

import type { Artifact, ArtifactStatus } from "../api/contract.ts";
import { splitPaths } from "./artifactPaths.ts";
import { receiptSuffix } from "./receipt.ts";

export const ARTIFACT_STATUSES: readonly ArtifactStatus[] = ["draft", "review", "accepted", "superseded"];

export const ARTIFACT_STATUS_CONSEQUENCE: Record<ArtifactStatus, string> = {
  draft: "A working copy again; nothing should rely on it yet.",
  review: "Offered for review; the reviewers named on the record are expected to look.",
  accepted: "The accepted record of what it describes.",
  superseded: "No longer current; whatever replaced it should be named in a review or decision.",
};

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/;

/** One path per line in the form, the CLI's comma-separated field in the record. */
export function joinPaths(lines: string): string {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
}

export function pathLines(uri: string): string {
  return splitPaths(uri).join("\n");
}

/** Ids typed by hand: separated by commas, spaces or newlines, each checked. */
export function splitIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// ---- correction ----------------------------------------------------------

export interface CorrectionDraft {
  paths: string;
  type: string;
  usageBoundaries: string;
}

export function correctionDraftFrom(artifact: Artifact): CorrectionDraft {
  return { paths: pathLines(artifact.uri), type: artifact.type, usageBoundaries: artifact.usage_boundaries };
}

/** The fields whose value differs from the record, in the CLI's spelling. */
export function correctionChanges(
  artifact: Artifact,
  draft: CorrectionDraft,
): Partial<Record<"uri" | "type" | "usage_boundaries", string>> {
  const changes: Partial<Record<"uri" | "type" | "usage_boundaries", string>> = {};
  const uri = joinPaths(draft.paths);
  if (uri !== joinPaths(pathLines(artifact.uri))) changes.uri = uri;
  if (draft.type.trim() !== artifact.type) changes.type = draft.type.trim();
  if (draft.usageBoundaries.trim() !== artifact.usage_boundaries) {
    changes.usage_boundaries = draft.usageBoundaries.trim();
  }
  return changes;
}

export function correctionBlockedReason(artifact: Artifact, draft: CorrectionDraft): string | null {
  if (!joinPaths(draft.paths)) return "At least one path is required.";
  if (!draft.type.trim()) return "Type is required.";
  if (Object.keys(correctionChanges(artifact, draft)).length === 0) return "Nothing has changed.";
  return null;
}

export function buildCorrectionRequest(
  artifact: Artifact,
  draft: CorrectionDraft,
  actorId: string,
): Record<string, unknown> {
  return { actor: actorId, if_status: artifact.status, ...correctionChanges(artifact, draft) };
}

const FIELD_WORDS: Record<string, string> = { uri: "paths", type: "type", usage_boundaries: "usage boundaries" };

export function correctionAnnouncement(id: string, changes: Record<string, unknown>, result: unknown): string {
  const words = Object.keys(changes).map((field) => FIELD_WORDS[field] ?? field);
  return `${id} corrected: ${words.join(", ")}.${receiptSuffix(result)}`;
}

// ---- status -------------------------------------------------------------

export function statusBlockedReason(artifact: Artifact, status: ArtifactStatus | ""): string | null {
  if (!status) return "Choose the status this artifact moves to.";
  if (status === artifact.status) return `It is already ${artifact.status}.`;
  return null;
}

export function buildStatusRequest(artifact: Artifact, status: ArtifactStatus, actorId: string): Record<string, unknown> {
  return { status, actor: actorId, if_status: artifact.status };
}

export function statusAnnouncement(id: string, previous: string, result: { status: string }): string {
  return `${id} is now ${result.status}, was ${previous}.${receiptSuffix(result)}`;
}

// ---- registration -------------------------------------------------------

export interface RegistrationDraft {
  id: string;
  paths: string;
  type: string;
  status: ArtifactStatus;
  usageBoundaries: string;
  owner: string;
  tasks: string;
  reviewers: string;
}

export function emptyRegistration(owner: string): RegistrationDraft {
  return { id: "", paths: "", type: "", status: "draft", usageBoundaries: "", owner, tasks: "", reviewers: "" };
}

export function registrationBlockedReason(draft: RegistrationDraft): string | null {
  if (!draft.id.trim()) return "An id is required.";
  if (!IDENTIFIER.test(draft.id.trim())) return "The id must start with a letter or digit and use only letters, digits and . _ : @ + -";
  if (!joinPaths(draft.paths)) return "At least one path is required.";
  if (!draft.type.trim()) return "Type is required.";
  if (!draft.owner) return "An owner is required.";
  const bad = [...splitIds(draft.tasks), ...splitIds(draft.reviewers)].find((id) => !IDENTIFIER.test(id));
  if (bad) return `${bad} is not an identifier.`;
  return null;
}

export function buildRegistrationRequest(draft: RegistrationDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: draft.id.trim(),
    uri: joinPaths(draft.paths),
    owner: draft.owner,
    type: draft.type.trim(),
    status: draft.status,
  };
  if (draft.usageBoundaries.trim()) body.usage_boundaries = draft.usageBoundaries.trim();
  const tasks = splitIds(draft.tasks);
  if (tasks.length) body.tasks = tasks;
  const reviewers = splitIds(draft.reviewers);
  if (reviewers.length) body.reviewers = reviewers;
  return body;
}

export function registrationAnnouncement(id: string, status: string, result: unknown): string {
  return `${id} registered as ${status}.${receiptSuffix(result)}`;
}
