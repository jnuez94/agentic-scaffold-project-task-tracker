/**
 * Paging over rows the console has actually loaded.
 *
 * Deliberately client-side. `task list` and friends accept `--limit` and
 * `--offset` but return no total, so a server-paged table could never honestly
 * say how many pages exist. Paging the loaded window can: the console knows
 * exactly how many rows it holds, so "of 137 loaded" is a true statement in a
 * way "of 137" would not be.
 *
 * The cost is that the window is bounded by the request limit, which
 * `isTruncated` exposes so the table can say so rather than quietly implying
 * it holds everything.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
/** 10 is available for cramped viewports, but 25 stays the default. */
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** How many pages `total` rows occupy. Always at least one, so page 1 exists. */
export function pageCount(total: number, size: number): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(total / size));
}

/** Keep a page number inside range; filtering can shrink the set underneath it. */
export function clampPage(page: number, total: number, size: number): number {
  const last = pageCount(total, size);
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), last);
}

/** The rows belonging to one page. */
export function pageSlice<T>(rows: readonly T[], page: number, size: number): T[] {
  const safe = clampPage(page, rows.length, size);
  const start = (safe - 1) * size;
  return rows.slice(start, start + size);
}

/** 1-indexed inclusive bounds of the current page, or nulls when empty. */
export function pageBounds(
  page: number,
  size: number,
  total: number,
): { first: number | null; last: number | null } {
  if (total === 0) return { first: null, last: null };
  const safe = clampPage(page, total, size);
  const first = (safe - 1) * size + 1;
  return { first, last: Math.min(first + size - 1, total) };
}

/**
 * Range copy.
 *
 * Always qualified with "loaded". The unqualified form would read as a
 * complete count of what exists, which the contract cannot support.
 */
export function rangeLabel(
  page: number,
  size: number,
  total: number,
  options: { filtered?: boolean; truncated?: boolean } = {},
): string {
  const noun = total === 1 ? "row" : "rows";
  if (total === 0) return options.filtered ? "No rows match this filter" : "No rows loaded";

  const { first, last } = pageBounds(page, size, total);
  const scope = options.filtered ? " (filtered)" : "";
  const more = options.truncated ? "+" : "";
  const base =
    total <= size
      ? `${total}${more} ${noun} loaded${scope}`
      : `Showing ${first}–${last} of ${total}${more} loaded${scope}`;
  return base;
}

/**
 * Whether the loaded window hit the request limit, meaning more rows may exist
 * on the server that the console never fetched.
 */
export function isTruncated(loaded: number, requestLimit: number): boolean {
  return loaded >= requestLimit;
}
