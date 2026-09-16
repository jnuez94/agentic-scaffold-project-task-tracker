/**
 * The audit view's loaded window.
 *
 * `/api/audit` returns the newest N entries matching the request and nothing
 * else: no total, no server-side search. The type and action pickers are part
 * of the request (UI-66), so the window is the newest N matching events; the
 * filter box narrows what was loaded, because free text has no CLI
 * equivalent and the console must not imply search.
 */

import { pageBounds } from "./pagination.ts";

/** Fields the loaded-row filter box searches. */
export const AUDIT_FILTER_FIELDS = [
  "actor",
  "action",
  "object_type",
  "object_id",
  "detail",
  "session_id",
];

export interface AuditRangeOptions {
  /** Rows loaded, across every page fetched so far. */
  window: number;
  /** The filter box is narrowing the loaded rows. */
  narrowed: boolean;
  /** What the request narrowed to — "task events" — or "" for everything. */
  noun?: string;
}

/**
 * Range copy for the audit view.
 *
 * The shared label hedges about truncation with a plus sign and "may exist",
 * which is right for lists that are occasionally capped. This window is
 * always the newest N of a log that is always longer, so the label states the
 * window instead of hedging about it: "of the newest 500 task events", and
 * when the filter box narrows it, "37 matching, within the newest 500". The
 * window grows as older pages are loaded, so the count carries a thousands
 * separator once it needs one.
 */
export function auditRangeLabel(
  page: number,
  size: number,
  total: number,
  options: AuditRangeOptions,
): string {
  if (total === 0) {
    return options.narrowed ? "No loaded entries match this filter" : "No entries loaded";
  }
  const { first, last } = pageBounds(page, size, total);
  const prefix = total <= size ? "" : `Showing ${first}–${last} of `;
  const noun = options.noun ? ` ${options.noun}` : "";
  const count = total.toLocaleString("en-US");
  if (!options.narrowed) {
    return prefix ? `${prefix}the newest ${count}${noun}` : `The newest ${count}${noun}`;
  }
  const window = options.window.toLocaleString("en-US");
  return `${prefix}${count} matching, within the newest ${window}${noun}`;
}
