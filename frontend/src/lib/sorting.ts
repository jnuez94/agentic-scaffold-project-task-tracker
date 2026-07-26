/**
 * Client-side column sorting.
 *
 * Scoped to loaded rows, like the filter box. The CLI defines a deterministic
 * default order per command (`task list` is priority, updated_at, id) and
 * exposes no sort parameter, so nothing here can reorder records that were
 * never fetched.
 *
 * That is why the cycle is tri-state rather than a toggle: the third click
 * clears sorting and restores the contract's documented order, which is a
 * meaningful state to be able to get back to.
 */

export type SortValue = string | number | null | undefined;
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

/**
 * Order two cell values.
 *
 * Empty values always sort last regardless of direction: a blank cell is
 * absence of data, and burying it under a descending sort would push real
 * rows off the top of the view.
 */
export function compareValues(a: SortValue, b: SortValue): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  return String(a).localeCompare(String(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * Return a sorted copy. The input is never mutated, and the sort is stable, so
 * rows with equal keys keep the CLI's ordering relative to each other.
 */
export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => SortValue,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const result = compareValues(getValue(left), getValue(right));
    // Empty-last must survive the direction flip, so only order real
    // comparisons get inverted.
    if (result === 0) return 0;
    const leftEmpty = isEmpty(getValue(left));
    const rightEmpty = isEmpty(getValue(right));
    if (leftEmpty || rightEmpty) return result;
    return result * sign;
  });
}

function isEmpty(value: SortValue): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Advance the tri-state cycle for a header click:
 * a new column starts ascending, then descending, then clears.
 */
export function nextSortState(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

/** The `aria-sort` token for a header. */
export function ariaSortFor(
  current: SortState | null,
  key: string,
): "ascending" | "descending" | "none" {
  if (!current || current.key !== key) return "none";
  return current.direction === "asc" ? "ascending" : "descending";
}
