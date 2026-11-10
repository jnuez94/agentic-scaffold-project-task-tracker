/**
 * What changed on a record since the operator loaded it (UI-33), for the
 * banner a compare-and-swap refusal shows. The refusal said "you lost"; this
 * says what they lost to, from the record's own audit rows.
 *
 * "Since loaded" is read from the rows themselves, not from clocks:
 * - a task changes by revision, and every change that moved it past the
 *   loaded revision says so ("revision 3 -> 4");
 * - a decision, an artifact or an escalation is guarded by status, so the
 *   change that lost the race is the first move away from the loaded status,
 *   and everything recorded after it counts. A status can be revisited
 *   (draft -> review -> draft), so the search starts at the loaded row's
 *   `updated_at`: a move recorded before the snapshot was taken is history,
 *   not a change since. Rows after that second count even when they come
 *   before the move (a correction made after the load).
 * - when the form read the record's last audit id coherently with it
 *   (`auditId`, UI-87), every row after that id counts and no clock is read:
 *   the CLI stamps `updated_at` before its write lock and the audit row after,
 *   so a change already shown can carry a later second than the snapshot.
 */

import type { AuditEntry } from "../api/contract.ts";
import { parseBecause } from "./because.ts";
import { humanize } from "./labels.ts";

export type Loaded =
  | { revision: number }
  /**
   * `updatedAt` is the loaded row's `updated_at`, the snapshot's boundary.
   * `auditId`, when known, is the last audit row the loaded row reflects, and
   * replaces that boundary.
   */
  | { status: string; updatedAt?: string; auditId?: number };

/** What the operator was changing, to name a collision ("You were editing Assignees"). */
export interface Editing {
  label: string;
  /** True when this change touched what the operator was editing. */
  touches: (entry: AuditEntry) => boolean;
}

const REVISION = /revision (\d+) -> \d+/;

/** The rows recorded since the record was loaded, newest first. */
export function changesSince(entries: readonly AuditEntry[], loaded: Loaded): AuditEntry[] {
  const ascending = [...entries].sort((a, b) => a.id - b.id);
  let since: AuditEntry[];
  if ("revision" in loaded) {
    since = ascending.filter((entry) => {
      const match = REVISION.exec(entry.detail);
      return match ? Number(match[1]) >= loaded.revision : false;
    });
  } else if (loaded.auditId !== undefined) {
    const watermark = loaded.auditId;
    since = ascending.filter((entry) => entry.id > watermark);
  } else {
    // Timestamps are whole seconds, so a row in the snapshot's own second may
    // be the change that produced it or one that raced it: those count only
    // from the move away from the loaded status. Later seconds always count.
    const boundary = loaded.updatedAt ? Date.parse(loaded.updatedAt) : Number.NEGATIVE_INFINITY;
    const after = ascending.filter((entry) => Date.parse(entry.created_at) >= boundary);
    const move = after.findIndex((entry) => entry.detail.startsWith(`${loaded.status} -> `));
    const later = loaded.updatedAt ? after.findIndex((entry) => Date.parse(entry.created_at) > boundary) : -1;
    const starts = [move, later].filter((index) => index !== -1);
    since = starts.length && move !== -1 ? after.slice(Math.min(...starts)) : [];
  }
  return since.reverse();
}

const FIELD_LABELS: Record<string, string> = {
  next_steps: "Next steps",
  blocked_claims: "Does not authorize",
  acceptance_criteria: "Acceptance criteria",
  usage_boundaries: "Usage boundaries",
  uri: "Paths",
};

const fieldLabel = (field: string) => FIELD_LABELS[field] ?? humanize(field);

/** The fields an edit or correction named (`fields=a,b`). */
export function editedFields(entry: AuditEntry): string[] {
  const match = /fields=([^;]+)/.exec(entry.detail);
  return match ? match[1]!.split(",").map((field) => field.trim()).filter(Boolean) : [];
}

/** One change as the banner says it: "Status: in_progress -> review". */
export function describeChange(entry: AuditEntry): string {
  const { text } = parseBecause(entry.detail);
  const transition = /^(\w+) -> (\w+)/.exec(text);
  switch (entry.action) {
    case "status":
    case "release":
    case "resolve":
      return transition ? `Status: ${transition[1]} -> ${transition[2]}` : `Status: ${text.split(";")[0]}`;
    case "claim":
      return "Claimed";
    case "assign": {
      const added = /add=([^;]*)/.exec(text)?.[1]?.split(",").filter(Boolean) ?? [];
      const removed = /remove=([^;]*)/.exec(text)?.[1]?.split(",").filter(Boolean) ?? [];
      const parts = [...added.map((id) => `+ ${id}`), ...removed.map((id) => `− ${id}`)];
      return `Assignees: ${parts.join(", ") || "unchanged"}`;
    }
    case "update": {
      const fields = editedFields(entry);
      return fields.length ? `Edited: ${fields.map(fieldLabel).join(", ")}` : "Edited";
    }
    default:
      return humanize(entry.action);
  }
}

/** The line that leads the list when the operator's own field changed too. */
export function collisionLine(changes: readonly AuditEntry[], editing: Editing | undefined): string | null {
  if (!editing || !changes.some(editing.touches)) return null;
  return `You were editing ${editing.label} — it changed too.`;
}

/** What each surface edits, for the collision line. */
export const EDITING = {
  status: { label: "the status", touches: (entry: AuditEntry) => ["status", "release", "claim", "resolve"].includes(entry.action) },
  assignees: { label: "Assignees", touches: (entry: AuditEntry) => entry.action === "assign" },
  correction: {
    label: "the record",
    touches: (entry: AuditEntry) => entry.action === "update" && editedFields(entry).length > 0,
  },
} satisfies Record<string, Editing>;
