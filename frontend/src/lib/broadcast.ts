/**
 * Rules for the human operator team broadcast.
 *
 * Contract: docs/ux-data-shape-and-workflow-spec.md, "Human operator team
 * broadcast". Reviewed in FE-BROADCAST-REVIEW-1.
 *
 * Pure functions so every readiness and validation branch is testable without
 * rendering a sheet or touching the network.
 */

import type { Agent } from "../api/contract.ts";
import { SETUP_PENDING } from "./copy.ts";

/** The literal recipient the contract reserves for team-wide messages. */
export const TEAM_RECIPIENT = "team";

export type Readiness =
  | { kind: "ready"; senderId: string }
  | { kind: "blocked"; reason: string };

export interface ReadinessInput {
  actor: Agent | undefined;
  sessionId: string | null;
  /** False while startup identity bootstrap is still resolving. */
  mutationsEnabled: boolean;
}

/**
 * Whether a broadcast may be sent right now.
 *
 * Deliberately stricter than the CLI: `message send` does not require a global
 * session, but criterion 6 does, so every broadcast is audited to a session.
 */
export function broadcastReadiness({
  actor,
  sessionId,
  mutationsEnabled,
}: ReadinessInput): Readiness {
  if (!mutationsEnabled) {
    return { kind: "blocked", reason: SETUP_PENDING };
  }
  if (!actor) {
    return { kind: "blocked", reason: "Select an actor in the header to broadcast." };
  }
  if (actor.actor_type !== "human") {
    return {
      kind: "blocked",
      // Not an authorization statement: it is a local accountability rule.
      reason: `Broadcasting is limited to a human actor. ${actor.name} is registered as ${actor.actor_type}.`,
    };
  }
  if (actor.status !== "active") {
    return { kind: "blocked", reason: `${actor.name} is inactive and cannot send messages.` };
  }
  if (!sessionId) {
    return {
      kind: "blocked",
      reason: "No active session is resolved. Select or start one in the header.",
    };
  }
  return { kind: "ready", senderId: actor.id };
}

export type BodyCheck = { valid: true; body: string } | { valid: false; reason: string };

/** Body is required, trimmed, and may not be whitespace-only (criterion 13). */
export function checkBody(raw: string): BodyCheck {
  const body = raw.trim();
  if (!body) return { valid: false, reason: "Enter a message before broadcasting." };
  return { valid: true, body };
}

export interface BroadcastDraft {
  body: string;
  task?: string;
  tags?: string;
}

export interface BroadcastRequest {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  task?: string;
  tags?: string;
}

/**
 * Build the request payload.
 *
 * `recipient` is always the literal `team` and is never taken from input.
 * Optional fields are omitted entirely when blank rather than sent empty, so
 * the stored row matches what the operator actually filled in.
 */
export function buildBroadcastRequest(
  id: string,
  senderId: string,
  draft: BroadcastDraft,
): BroadcastRequest {
  const request: BroadcastRequest = {
    id,
    sender: senderId,
    recipient: TEAM_RECIPIENT,
    body: draft.body.trim(),
  };
  const task = draft.task?.trim();
  if (task) request.task = task;
  const tags = draft.tags?.trim();
  if (tags) request.tags = tags;
  return request;
}

/**
 * Whether a failed attempt must be retried under a new id.
 *
 * Reusing the resolved id is correct for every failure except a duplicate id,
 * which would fail identically forever (FE-BROADCAST-REVIEW-1, item 1).
 */
export function requiresNewId(errorCode: string | undefined): boolean {
  return errorCode === "constraint_violation";
}
