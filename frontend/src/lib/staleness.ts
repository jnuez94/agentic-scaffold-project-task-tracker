/**
 * Reading how long ago a session was last seen, and how much that tells us.
 *
 * Health's staleness rule is `last_seen_at` older than the threshold, and that
 * rule cannot distinguish an abandoned session from a long-running one that is
 * simply idle between heartbeats. The difference matters enormously: recovering
 * an abandoned session releases stuck claims, while recovering a live one
 * blocks the tasks someone is actively working on and ends their session
 * underneath them.
 *
 * The console cannot resolve that ambiguity — nothing in the data can. What it
 * can do is refuse to hide it, which is why the age is always stated and the
 * caution is always present rather than shown only past some second threshold.
 */

import type { Session, TaskListRow } from "../api/contract.ts";

/** The CLI's own default recovery threshold, in seconds. */
export const STALE_AFTER_SECONDS = 3600;

export function secondsSinceSeen(lastSeenAt: string, now: Date = new Date()): number | null {
  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return null;
  return Math.max(0, Math.floor((now.getTime() - seen) / 1000));
}

/**
 * Whether the CLI would consider this session recoverable.
 *
 * Mirrors the contract's rule so the console does not offer an action the CLI
 * will refuse with `session_not_stale`.
 */
export function isRecoverable(
  session: Pick<Session, "status" | "last_seen_at">,
  now: Date = new Date(),
  thresholdSeconds: number = STALE_AFTER_SECONDS,
): boolean {
  if (session.status !== "active") return false;
  const age = secondsSinceSeen(session.last_seen_at, now);
  if (age === null) return false;
  return age >= thresholdSeconds;
}

/** "3 hours ago", for a sentence rather than a table cell. */
export function describeAge(seconds: number | null): string {
  if (seconds === null) return "at an unknown time";
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * The sentence shown before the operator can act.
 *
 * Deliberately not conditional on how stale the session is. A session idle for
 * three days is *probably* abandoned and a session idle for sixty-one minutes
 * probably is not, but "probably" is the console's guess, not a fact it holds,
 * and a caution that disappears when the guess is confident is a caution that
 * is missing exactly when it turns out to be wrong.
 */
export function recoveryCaution(lastSeenAt: string, now: Date = new Date()): string {
  const age = describeAge(secondsSinceSeen(lastSeenAt, now));
  return (
    `This session was last seen ${age}. Being past the staleness threshold does ` +
    `not mean it was abandoned — a long-running session that is idle between ` +
    `heartbeats looks identical. If it is still in use, recovering it will end ` +
    `it and block the work it is holding.`
  );
}

/** The tasks a session is currently holding, in id order. */
export function tasksClaimedBy(
  tasks: readonly TaskListRow[],
  sessionId: string,
): TaskListRow[] {
  return tasks
    .filter((task) => task.claim_session_id === sessionId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}
