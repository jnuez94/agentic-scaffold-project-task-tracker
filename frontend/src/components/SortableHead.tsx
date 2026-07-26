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
  defaultOrder,
  onSort,
}: {
  columns: Column<T>[];
  sort: SortState | null;
  defaultOrder: string | undefined;
  onSort: (key: string) => void;
}) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const state = ariaSortFor(sort, column.key);
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
                  title={hintFor(state, column.header, defaultOrder)}
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

function hintFor(
  state: "ascending" | "descending" | "none",
  header: string,
  defaultOrder: string | undefined,
): string {
  const restore = defaultOrder ? ` (${defaultOrder})` : "";
  if (state === "none") return `Sort loaded rows by ${header}, ascending`;
  if (state === "ascending") return `Sort loaded rows by ${header}, descending`;
  return `Clear sorting and restore the default order${restore}`;
}
