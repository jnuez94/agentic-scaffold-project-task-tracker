/**
 * The audit receipt on a mutation result (UI-71).
 *
 * Since 1.4.0 every successful mutation's envelope carries `audit_range`, the
 * first and last audit ids it wrote. The client merges it into the result, so
 * a confirmation can say what the action recorded — and say nothing when the
 * receipt is absent, rather than invent one.
 */

export type AuditRange = [number, number];

export interface Receipted {
  audit_range?: AuditRange;
}

/** The audit view, where the ids a receipt names can be read. */
export const AUDIT_VIEW_HREF = "#/audit";

export function auditRangeOf(result: unknown): AuditRange | null {
  if (!result || typeof result !== "object") return null;
  const range = (result as Receipted).audit_range;
  if (!Array.isArray(range) || range.length !== 2) return null;
  const [first, last] = range;
  return typeof first === "number" && typeof last === "number" ? [first, last] : null;
}

/**
 * " Recorded as audit 1806." — with its leading space, so it can follow any
 * confirmation sentence; "" when the result carries no receipt.
 */
export function receiptSuffix(result: unknown): string {
  const range = auditRangeOf(result);
  if (!range) return "";
  const [first, last] = range;
  return first === last ? ` Recorded as audit ${first}.` : ` Recorded as audit ${first}–${last}.`;
}
