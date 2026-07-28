/**
 * Which inspector fields render, and in what order.
 *
 * Pure, and in lib rather than beside the layouts, because the rule it encodes
 * is the one worth testing exhaustively: constraint fields always render —
 * showing "None recorded" when empty, because "we did not limit this" is a
 * statement an operator needs — while empty descriptive fields are dropped so
 * the panel is not a column of blank labels.
 */

export interface OrderedField {
  key: string;
  label: string;
  constraint?: boolean;
  emptyText?: string;
}

/** Whether a value counts as absent for rendering purposes. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Constraint fields first, then the descriptive fields that have content. */
export function visibleFields<T extends OrderedField>(
  fields: readonly T[],
  row: Record<string, unknown>,
): T[] {
  const constraints = fields.filter((field) => field.constraint);
  const rest = fields.filter((field) => !field.constraint && !isEmptyValue(row[field.key]));
  return [...constraints, ...rest];
}
