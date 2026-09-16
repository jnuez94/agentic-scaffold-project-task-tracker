/**
 * The sortable header row.
 *
 * Split from DataTable purely for size. Headers are buttons carrying
 * `aria-sort` on the `th`, so sorting is keyboard operable and announced.
 */

import type { Column } from "./DataTable.tsx";
import { ariaSortFor, type SortState } from "../lib/sorting.ts";

const INDICATORS = { ascending: "\u25B2", descending: "\u25BC", none: "\u2195" } as const;

export function SortableHead<T>({
  columns,
  sort,
  requestSort = null,
  defaultOrder,
  onSort,
}: {
  columns: Column<T>[];
  sort: SortState | null;
  /** The request's own ordering, for columns that declare `orderBy` (UI-70). */
  requestSort?: SortState | null;
  defaultOrder: string | undefined;
  onSort: (key: string) => void;
}) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const ordersRequest = Boolean(column.orderBy) && requestSort !== undefined;
          const state = ariaSortFor(ordersRequest ? requestSort : sort, column.key);
          return (
            <th
              key={column.key}
              scope="col"
              style={column.width ? { width: column.width } : undefined}
              className={column.align === "end" ? "align-end" : undefined}
              data-priority={column.priority ?? 0}
              aria-sort={column.sortValue ? state : undefined}
            >
              {column.sortValue ? (
                <button
                  type="button"
                  className={state === "none" ? "sort-button" : "sort-button active"}
                  onClick={() => onSort(column.key)}
                  title={hintFor(state, column.header, defaultOrder, ordersRequest ? "request" : "loaded")}
                >
                  {column.header}
                  <span className="sort-indicator" aria-hidden="true">
                    {INDICATORS[state]}
                  </span>
                </button>
              ) : (
                column.header
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * What a click will do. Honest about the two kinds of sort: a column the
 * contract lists as orderable re-asks the CLI, so every row is ordered; any
 * other column sorts only what was loaded.
 */
function hintFor(
  state: "ascending" | "descending" | "none",
  header: string,
  defaultOrder: string | undefined,
  mode: "request" | "loaded",
): string {
  const restore = defaultOrder ? ` (${defaultOrder})` : "";
  const what = mode === "request" ? "Sort the request" : "Sort loaded rows";
  if (state === "none") return `${what} by ${header}, ascending`;
  if (state === "ascending") return `${what} by ${header}, descending`;
  return `Clear sorting and restore the default order${restore}`;
}
