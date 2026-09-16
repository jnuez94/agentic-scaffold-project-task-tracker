/**
 * What the console says after a task action (UI-71).
 *
 * The revision comes from the response, never from arithmetic on the row: a
 * claim is a lease, and another actor's claim can reap a holder silent for
 * over an hour — the revision then rises by two, not one, and the response
 * names the reaped session. Saying so is the difference between a takeover
 * the operator understands and one they discover in the audit log.
 */

import { receiptSuffix } from "./receipt.ts";

export interface ClaimResult {
  revision: number;
  status: string;
  reaped_session?: string | null;
}

export interface TransitionResult {
  revision: number;
  status: string;
}

export const REAPED_SENTENCE =
  " The previous holder's session was silent for over an hour and has been ended.";

export function claimAnnouncement(taskId: string, result: ClaimResult): string {
  const reaped = result.reaped_session ? REAPED_SENTENCE : "";
  return `${taskId} claimed at revision ${result.revision}.${reaped}${receiptSuffix(result)}`;
}

export function transitionAnnouncement(
  taskId: string,
  target: string,
  result: TransitionResult,
): string {
  return `${taskId} moved to ${target} at revision ${result.revision}.${receiptSuffix(result)}`;
}
