/**
 * A generic record table with optional column sorting.
 *
 * Real `<table>` markup, so header/row relationships stay programmatic for
 * assistive technology rather than being reconstructed from divs. Sortable
 * headers are buttons carrying `aria-sort`, so sorting is operable from the
 * keyboard and announced.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, SkeletonRows } from "./Feedback.tsx";
import { Pagination } from "./Pagination.tsx";
import { SortableHead } from "./SortableHead.tsx";
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  pageSlice,
  type PageSize,
} from "../lib/pagination.ts";
import { nextSortState, sortRows, type SortState, type SortValue } from "../lib/sorting.ts";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Supplying this makes the column sortable. */
  sortValue?: (row: T) => SortValue;
  /** Marks columns that may be hidden at narrow widths, lowest value first. */
  priority?: number;
  align?: "start" | "end";
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  loaded?: boolean;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  selectedKey?: string | null;
  onSelect?: (row: T) => void;
  /** Describes the server-side order restored when sorting is cleared. */
  defaultOrder?: string;
  /** Set false for short fixed lists that never need a pager. */
  paginate?: boolean;
  /** True when the loaded window hit the request limit. */
  truncated?: boolean;
  /** Whether a loaded-row filter is currently narrowing the set. */
  filtered?: boolean;
  /** Disambiguates pager control ids when tables share a document. */
  idPrefix?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  loaded = true,
  emptyTitle = "Nothing to show",
  emptyHint,
  selectedKey,
  onSelect,
  defaultOrder,
  paginate = true,
  truncated = false,
  filtered = false,
  idPrefix = "table",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortValue) return rows;
    return sortRows(rows, column.sortValue, sort.direction);
  }, [rows, columns, sort]);

  // Filtering or sorting can shrink the set under the current page.
  useEffect(() => {
    setPage((current) => clampPage(current, sorted.length, size));
  }, [sorted.length, size]);

  const visible = paginate ? pageSlice(sorted, page, size) : sorted;

  if (!loaded && loading) {
    return <SkeletonRows rows={6} columns={columns.length} />;
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">
          {caption}
          {sort
            ? `, sorted by ${labelFor(columns, sort.key)} ${sort.direction === "asc" ? "ascending" : "descending"}`
            : defaultOrder
              ? `, in ${defaultOrder}`
              : ""}
        </caption>
        <SortableHead
          columns={columns}
          sort={sort}
          defaultOrder={defaultOrder}
          onSort={(key) => setSort((current) => nextSortState(current, key))}
        />
        <tbody>
          {visible.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                className={selected ? "selected" : undefined}
                aria-selected={onSelect ? selected : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
                onKeyDown={
                  onSelect
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onSelect ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === "end" ? "align-end" : undefined}
                    data-priority={column.priority ?? 0}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {paginate ? (
        <Pagination
          page={clampPage(page, sorted.length, size)}
          size={size}
          total={sorted.length}
          filtered={filtered}
          truncated={truncated}
          onPage={setPage}
          onSize={(next) => {
            setSize(next);
            setPage(1);
          }}
          idPrefix={idPrefix}
        />
      ) : null}
    </div>
  );
}

function labelFor<T>(columns: Column<T>[], key: string): string {
  return columns.find((column) => column.key === key)?.header ?? key;
}
