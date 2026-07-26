/**
 * A generic record table with optional column sorting.
 *
 * Real `<table>` markup, so header/row relationships stay programmatic for
 * assistive technology rather than being reconstructed from divs. Sortable
 * headers are buttons carrying `aria-sort`, so sorting is operable from the
 * keyboard and announced.
 */

import { useMemo, useState, type ReactNode } from "react";
import { EmptyState, SkeletonRows } from "./Feedback.tsx";
import {
  ariaSortFor,
  nextSortState,
  sortRows,
  type SortState,
  type SortValue,
} from "../lib/sorting.ts";

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
}

const INDICATORS = { ascending: "▲", descending: "▼", none: "↕" } as const;

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
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortValue) return rows;
    return sortRows(rows, column.sortValue, sort.direction);
  }, [rows, columns, sort]);

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
                      onClick={() => setSort((current) => nextSortState(current, column.key))}
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
        <tbody>
          {sorted.map((row) => {
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
    </div>
  );
}

function labelFor<T>(columns: Column<T>[], key: string): string {
  return columns.find((column) => column.key === key)?.header ?? key;
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
