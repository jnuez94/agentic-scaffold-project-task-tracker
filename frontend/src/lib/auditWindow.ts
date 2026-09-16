/**
 * The audit view's loaded window.
 *
 * `/api/audit` returns the newest N entries and nothing else: no total, no
 * facet lists, no server-side search. Everything the view offers on top — the
 * object-type and action selects, the filter box — is computed here over the
 * rows it holds, so what the selects list and what the filter searches is
 * exactly what is on screen. That is the contract every other list in the
 * console already works under.
 */

import type { AuditEntry } from "../api/contract.ts";
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

export type AuditFacet = "object_type" | "action" | "actor";

export interface AuditNarrowing {
  objectType: string;
  action: string;
}

/** Distinct values of one field across the loaded rows, sorted, empties dropped. */
export function facetValues(rows: readonly AuditEntry[], field: AuditFacet): string[] {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort();
}

/**
 * Range copy for the audit view.
 *
 * The shared label hedges about truncation with a plus sign and "may exist",
 * which is right for lists that are occasionally capped. This window is
 * always the newest N of a log that is always longer, so the label states the
 * window instead of hedging about it: "of the newest 500", and when narrowed,
 * "37 matching, within the newest 500".
 */
export function auditRangeLabel(
  page: number,
  size: number,
  total: number,
  options: { window: number; narrowed: boolean },
): string {
  if (total === 0) {
    return options.narrowed ? "No loaded entries match this filter" : "No entries loaded";
  }
  const { first, last } = pageBounds(page, size, total);
  const prefix = total <= size ? "" : `Showing ${first}–${last} of `;
  if (!options.narrowed) return prefix ? `${prefix}the newest ${total}` : `The newest ${total}`;
  return `${prefix}${total} matching, within the newest ${options.window}`;
}

/** The loaded rows matching both selects; the same array when neither is set. */
export function narrowAudit(rows: AuditEntry[], by: AuditNarrowing): AuditEntry[] {
  if (!by.objectType && !by.action) return rows;
  return rows.filter(
    (row) =>
      (!by.objectType || row.object_type === by.objectType) &&
      (!by.action || row.action === by.action),
  );
}
