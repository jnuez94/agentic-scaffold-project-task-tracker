/**
 * A generic record table.
 *
 * Real `<table>` markup, so header/row relationships stay programmatic for
 * assistive technology rather than being reconstructed from divs.
 */

import type { ReactNode } from "react";
import { EmptyState, SkeletonRows } from "./Feedback.tsx";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
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
}: DataTableProps<T>) {
  if (!loaded && loading) {
    return <SkeletonRows rows={6} columns={columns.length} />;
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.align === "end" ? "align-end" : undefined}
                data-priority={column.priority ?? 0}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
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
