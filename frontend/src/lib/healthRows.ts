/**
 * Reading a health finding without knowing which section it came from.
 *
 * Section rows are exact per the contract — stored Task rows, Session rows,
 * Escalation rows, or the invalid-claim shape — but the view renders them all
 * as "id — description", so these read the fields defensively rather than
 * branching on a section name that a future package version may add to.
 */

import type { Session, Task } from "../api/contract.ts";

/** The record's own id, or a stable placeholder when the row carries none. */
export function identify(row: unknown, index: number): string {
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    for (const key of ["id", "task_id", "session_id"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return `row-${index}`;
}

export function describe(row: unknown): string {
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    if (typeof record["title"] === "string") return record["title"];
    if (typeof record["issue"] === "string") return record["issue"];
    if (typeof record["harness"] === "string") return `harness ${record["harness"]}`;
  }
  return "";
}

/** A health row is only a task if it carries what a task action needs. */
export function asTask(row: unknown): Task | null {
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<Task>;
  return typeof candidate.id === "string" && typeof candidate.status === "string"
    ? (row as Task)
    : null;
}

/** A health row is only a session if it carries what recovery needs. */
export function asSession(row: unknown): Session | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record["id"] !== "string" || typeof record["last_seen_at"] !== "string") return null;
  return record as unknown as Session;
}
