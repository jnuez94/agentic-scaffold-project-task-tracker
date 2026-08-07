/**
 * Table pager.
 *
 * Page numbers are honest here because they count loaded rows, which the
 * console knows exactly. A truncation note appears when the loaded window hit
 * the request limit, so "page 4 of 4" never implies there is nothing further
 * on the server.
 */

import {
  clampPage,
  pageCount,
  PAGE_SIZES,
  rangeLabel,
  type PageSize,
} from "../lib/pagination.ts";
import { usePagingAnnouncement } from "../state/usePagingAnnouncement.ts";

export interface PaginationProps {
  page: number;
  size: PageSize;
  total: number;
  filtered?: boolean;
  truncated?: boolean;
  onPage: (page: number) => void;
  onSize: (size: PageSize) => void;
  /** Distinguishes the two selects when several tables share a document. */
  idPrefix: string;
}

export function Pagination({
  page,
  size,
  total,
  filtered = false,
  truncated = false,
  onPage,
  onSize,
  idPrefix,
}: PaginationProps) {
  const last = pageCount(total, size);
  const current = clampPage(page, total, size);
  const onlyOnePage = total <= size;
  const label = rangeLabel(current, size, total, { filtered, truncated });

  // The visible range is no longer a live region. It re-announced on every
  // data change, including the refresh each mutation triggers, which is what
  // buried mutation confirmations (UI-32). Paging still announces, through
  // the region below, because the operator asked for that change.
  const [pagingMessage, markPaging] = usePagingAnnouncement(label);
  const paged = (next: number) => {
    markPaging();
    onPage(next);
  };

  return (
    <nav className="pagination" aria-label="Table pages">
      <p className="pagination-range small muted">{label}</p>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {pagingMessage}
      </div>

      {truncated ? (
        <p className="pagination-truncated small">
          The request limit was reached, so more rows may exist that are not loaded.
        </p>
      ) : null}

      <div className="pagination-controls">
        <label htmlFor={`${idPrefix}-page-size`} className="visually-hidden">
          Rows per page
        </label>
        <select
          id={`${idPrefix}-page-size`}
          className="page-size"
          value={size}
          onChange={(event) => {
            markPaging();
            onSize(Number(event.target.value) as PageSize);
          }}
        >
          {PAGE_SIZES.map((value) => (
            <option key={value} value={value}>
              {value} per page
            </option>
          ))}
        </select>

        <button onClick={() => paged(1)} disabled={onlyOnePage || current === 1}>
          First
        </button>
        <button onClick={() => paged(current - 1)} disabled={current === 1}>
          Previous
        </button>
        <span className="pagination-position small">
          Page {current} of {last}
          <span className="visually-hidden"> of loaded rows</span>
        </span>
        <button onClick={() => paged(current + 1)} disabled={current >= last}>
          Next
        </button>
        <button onClick={() => paged(last)} disabled={onlyOnePage || current >= last}>
          Last
        </button>
      </div>
    </nav>
  );
}
