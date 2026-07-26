/**
 * Client-side row filtering.
 *
 * Scoped deliberately to *loaded* rows. `task list` filters only by status and
 * assignee, and list results carry no total count, so a filter applied here
 * cannot honestly claim to cover records that were never fetched. Views label
 * it as filtering loaded rows for that reason (FE-ARCH-REVIEW-1 item 2).
 */

/** Any object; fields are read defensively rather than through an index signature. */
export type Searchable = object;

function read(row: Searchable, field: string): unknown {
  return (row as Record<string, unknown>)[field];
}

/** Collect the string and number leaves of a record into one haystack. */
export function haystack(row: Searchable, fields: string[]): string {
  const parts: string[] = [];
  for (const field of fields) {
    const value = read(row, field);
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      parts.push(value.filter((item) => typeof item === "string").join(" "));
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Match every whitespace-separated term, so "ui blocked" narrows rather than
 * widening the way a single substring match would.
 */
export function matches(row: Searchable, fields: string[], query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const target = haystack(row, fields);
  return trimmed.split(/\s+/).every((term) => target.includes(term));
}

export function filterRows<T extends Searchable>(
  rows: T[],
  fields: string[],
  query: string,
): T[] {
  if (!query.trim()) return rows;
  return rows.filter((row) => matches(row, fields, query));
}
