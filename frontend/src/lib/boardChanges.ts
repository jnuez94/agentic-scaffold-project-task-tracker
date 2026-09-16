/**
 * Saying what moved on the board (UI-75), from the audit rows recorded since
 * the cursor the view loaded at.
 *
 * Counts by object type and names the actors, so the marker reads "3 tasks
 * and 1 review changed — david, toby" rather than "the board changed".
 * Heartbeats are not changes: a session saying it is alive moves no record,
 * and counting it would keep the marker lit for as long as anyone is working.
 */

import type { AuditEntry } from "../api/contract.ts";

const PLURALS: Record<string, string> = {
  task: "tasks",
  review: "reviews",
  decision: "decisions",
  message: "messages",
  agent: "agents",
  session: "sessions",
  artifact: "artifacts",
  escalation: "escalations",
  dependency: "dependencies",
  evidence: "evidence",
  database: "database",
};

export const IGNORED_ACTIONS: readonly string[] = ["heartbeat"];

function plural(type: string, count: number): string {
  return count === 1 ? type : (PLURALS[type] ?? `${type}s`);
}

/** "" when nothing that counts as a change was recorded. */
export function describeAuditChanges(entries: readonly AuditEntry[]): string {
  const counted = entries.filter((entry) => !IGNORED_ACTIONS.includes(entry.action));
  if (counted.length === 0) return "";

  const byType = new Map<string, Set<string>>();
  for (const entry of counted) {
    const ids = byType.get(entry.object_type) ?? new Set<string>();
    ids.add(entry.object_id);
    byType.set(entry.object_type, ids);
  }
  const parts = [...byType.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([type, ids]) => `${ids.size} ${plural(type, ids.size)}`);
  const what =
    parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const actors = [...new Set(counted.map((entry) => entry.actor))].sort();
  return `${what} changed — ${actors.join(", ")}`;
}
