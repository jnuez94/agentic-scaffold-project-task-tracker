/**
 * A list read newest first, a page at a time, that grows backwards (UI-86).
 *
 * The CLI lists oldest first by default and caps a page at 500 rows, so a
 * plain `useResource` over `limit: 500` showed a busy project's oldest 500
 * rows and never its newest. Every main list now asks for a newest-first
 * order and reads one page; "Load older" appends the next page.
 *
 * Pages are read by offset, because these lists may be ordered by any column
 * the operator picks. Offsets move when the set changes underneath: a new row
 * at the top shifts everything down, and a loaded row leaving a filter (a task
 * done while the queue shows open work) shifts everything up, so the next page
 * would skip a row nobody saw. So each older page starts one row early, on the
 * last row already held. If that row is still there, nothing before it moved
 * and the page follows on exactly. If it isn't, the window is read again from
 * the top to the same depth plus a page, replacing what was held; that read
 * checks every page boundary the same way.
 *
 * Each first-page load is a generation. "Load older" is refused until the
 * current generation's first page has succeeded: while it is pending, and
 * after it failed, when the rows still shown answer the previous query. An
 * older page that lands after a newer generation started is dropped, so rows
 * of two different queries never mix.
 *
 * The result is a `Resource`, so a view reads `data`, `loaded`, and `refresh`
 * as before. `lastUpdated` moves only when the newest page is read, never when
 * older rows are appended: it is what a view anchors "the board changed" to.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";
import type { Resource } from "./useResource.ts";

export const LIST_PAGE_SIZE = 500;
/** A re-read restarts at most this many times when the set keeps moving. */
const REREAD_ATTEMPTS = 3;

export interface ListWindow<T> extends Resource<T[]> {
  /** The last page came back short: nothing older is left to load. */
  exhausted: boolean;
  /** An older page is being read. */
  loadingOlder: boolean;
  /** The rows held answer the current query, so an older page may follow them. */
  pageable: boolean;
  loadOlder: () => void;
}

type Page = { limit: number; offset: number };

export function useListWindow<T>(
  load: (page: Page) => Promise<T[]>,
  keyOf: (row: T) => string,
  deps: readonly unknown[],
  options: { enabled?: boolean; pageSize?: number } = {},
): ListWindow<T> {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? LIST_PAGE_SIZE;
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);
  const [nonce, setNonce] = useState(0);
  // Generations as state, for render: the one asked for, and the one held.
  const [askedFor, setAskedFor] = useState(0);
  const [heldFor, setHeldFor] = useState(0);

  const loadRef = useRef(load);
  loadRef.current = load;
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;
  const held = useRef<T[]>([]);
  // The query generation the held rows answer; bumped by every first-page load.
  const generation = useRef(0);
  // The generation whose first page filled `held`. Paging follows only that.
  const heldGeneration = useRef(0);
  // True from a first-page request until it settles: no paging meanwhile.
  const replacing = useRef(false);
  const older = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = useCallback(
    (caught: unknown) =>
      setError(caught instanceof ApiError ? caught : new ApiError("network_error", describeThrown(caught), 0)),
    [],
  );

  const keep = useCallback((rows: T[]) => {
    held.current = rows;
    setData(rows);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const current = ++generation.current;
    replacing.current = true;
    setAskedFor(current);
    setLoading(true);
    loadRef
      .current({ limit: pageSize, offset: 0 })
      .then((page) => {
        if (!mounted.current || current !== generation.current) return;
        keep(page);
        heldGeneration.current = current;
        setHeldFor(current);
        setExhausted(page.length < pageSize);
        setError(undefined);
        setLastUpdated(new Date());
      })
      .catch((caught: unknown) => {
        if (!mounted.current || current !== generation.current) return;
        fail(caught);
      })
      .finally(() => {
        if (!mounted.current || current !== generation.current) return;
        replacing.current = false;
        setLoading(false);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, pageSize]);

  /**
   * Read the window again from the top, at least `depth` rows deep. The set
   * can move during this read as it did before it, so every page after the
   * first also starts on the last row read; when that row has moved the read
   * starts over. A set that moves under every attempt fails the load: the
   * rows held stay, and nothing is called exhausted.
   */
  const reread = useCallback(
    async (depth: number): Promise<{ rows: T[]; short: boolean }> => {
      for (let attempt = 0; attempt < REREAD_ATTEMPTS; attempt += 1) {
        const rows: T[] = [];
        const seen = new Set<string>();
        let moved = false;
        while (rows.length < depth) {
          const last = rows[rows.length - 1];
          const page = await loadRef.current({ limit: pageSize, offset: last ? rows.length - 1 : 0 });
          const next = last ? page.slice(1) : page;
          // The boundary row can hold its place while a row already read
          // moves below it (one in above, one down): a repeat says so too.
          if (
            (last && (!page[0] || keyRef.current(page[0]) !== keyRef.current(last))) ||
            next.some((row) => seen.has(keyRef.current(row)))
          ) {
            moved = true;
            break;
          }
          for (const row of next) {
            seen.add(keyRef.current(row));
            rows.push(row);
          }
          if (page.length < pageSize) return { rows, short: true };
        }
        if (!moved) return { rows, short: false };
      }
      throw new ApiError("list_moving", "The list kept changing while it was read. Try again.", 0);
    },
    [pageSize],
  );

  const loadOlder = useCallback(() => {
    if (!enabled || replacing.current || older.current) return;
    const current = generation.current;
    // A failed reload leaves the previous query's rows: an older page of the
    // new query must not be stitched onto them.
    if (heldGeneration.current !== current) return;
    const before = held.current;
    const last = before[before.length - 1];
    if (!last) return;
    older.current = true;
    setLoading(true);
    setLoadingOlder(true);

    const lastKey = keyRef.current(last);
    // One row early: the page must start on the last row held.
    const step = async (): Promise<{ rows: T[]; short: boolean }> => {
      const page = await loadRef.current({ limit: pageSize, offset: before.length - 1 });
      if (page[0] && keyRef.current(page[0]) === lastKey) {
        const seen = new Set(before.map((row) => keyRef.current(row)));
        const next = page.slice(1);
        // A row already held coming back below the boundary means the rows
        // above it moved after all, however the boundary lines up.
        if (!next.some((row) => seen.has(keyRef.current(row)))) {
          return { rows: [...before, ...next], short: page.length < pageSize };
        }
      }
      // The rows before it moved: read the window again rather than guess.
      return reread(before.length + pageSize);
    };

    step()
      .then(({ rows, short }) => {
        if (!mounted.current || current !== generation.current) return;
        keep(rows);
        setExhausted(short);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!mounted.current || current !== generation.current) return;
        fail(caught);
      })
      .finally(() => {
        older.current = false;
        if (!mounted.current) return;
        setLoadingOlder(false);
        if (current === generation.current) setLoading(replacing.current);
      });
  }, [enabled, pageSize, reread, keep, fail]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const pageable = heldFor !== 0 && heldFor === askedFor && !loading;
  return { data, error, loading, loaded, lastUpdated, refresh, exhausted, loadingOlder, loadOlder, pageable };
}
