/**
 * What needs someone, grouped so it fits above the queue in one line.
 *
 * UI-42 asks for Health's findings to be reachable where the work is, so that
 * noticing something and acting on it are one motion rather than two. It is
 * explicitly *not* a new surface: UX-SCOPE-2 rejected an Attention workspace,
 * and this must not reintroduce it. So this produces counts for a strip, not
 * a model for a dashboard — no history, no trend, no per-finding detail.
 *
 * Built on the same `attentionReason` the row highlight uses, which is what
 * makes the strip and the rows agree by construction rather than by review.
 */

import type { TaskListRow } from "../api/contract.ts";
import {
  ATTENTION_LABELS,
  attentionReason,
  type AttentionContext,
  type AttentionReason,
} from "./attention.ts";

export interface AttentionGroup {
  reason: AttentionReason;
  label: string;
  count: number;
}

/**
 * Most-blocking first, not most-numerous first.
 *
 * Sorting by count would put "awaiting review" — the largest group on a mature
 * board — ahead of a single blocked task, which inverts what the operator
 * should look at. Blocked work cannot move at all; a review is waiting on a
 * person who can still act.
 */
const SEVERITY: AttentionReason[] = ["blocked", "stale-claim", "unowned", "awaiting-review"];

export function summariseAttention(
  tasks: readonly TaskListRow[],
  context: AttentionContext = {},
): AttentionGroup[] {
  const counts = new Map<AttentionReason, number>();
  for (const task of tasks) {
    const reason = attentionReason(task, context);
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return SEVERITY.filter((reason) => counts.has(reason)).map((reason) => ({
    reason,
    label: ATTENTION_LABELS[reason],
    count: counts.get(reason) ?? 0,
  }));
}

/** The single number the strip leads with. */
export function attentionTotal(groups: readonly AttentionGroup[]): number {
  return groups.reduce((total, group) => total + group.count, 0);
}

/** Short label for a filter chip, where the full sentence would not fit. */
export const SHORT_LABELS: Record<AttentionReason, string> = {
  blocked: "Blocked",
  "stale-claim": "Stale claim",
  unowned: "Unowned",
  "awaiting-review": "In review",
};
