/**
 * A list read newest first, a page at a time, that grows backwards (UI-86).
 *
 * The CLI lists oldest first by default and caps a page at 500 rows, so a
 * plain `useResource` over `limit: 500` showed a busy project's oldest 500
 * rows and never its newest. Every main list now asks for a newest-first
 * order and reads one page; "Load older" appends the next page by offset.
 *
 * Offset, not a cursor: these lists may be ordered by any column the operator
 * picks, and the only way the set changes underneath is new rows arriving at
 * the top. That shifts older pages down, so a later page can repeat rows
 * already held but never skip one. Repeats are dropped by key.
 *
 * The result is a `Resource`, so a view swaps this in without changing how
 * it reads `data`, `loaded`, or `refresh`. A refresh goes back to the newest
 * page and drops what was loaded behind it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";
import type { Resource } from "./useResource.ts";

export const LIST_PAGE_SIZE = 500;

export interface ListWindow<T> extends Resource<T[]> {
  /** The last page came back short: nothing older is left to load. */
  exhausted: boolean;
  /** An older page is being read. */
  loadingOlder: boolean;
  loadOlder: () => void;
}

export function useListWindow<T>(
  load: (page: { limit: number; offset: number }) => Promise<T[]>,
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

  const loadRef = useRef(load);
  loadRef.current = load;
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;
  // How many rows the server has handed over, repeats included: the next offset.
  const offset = useRef(0);
  // A slow earlier request must not land on top of a newer one.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = (caught: unknown) =>
    setError(caught instanceof ApiError ? caught : new ApiError("network_error", describeThrown(caught), 0));

  useEffect(() => {
    if (!enabled) return;
    const current = ++requestId.current;
    setLoading(true);
    loadRef
      .current({ limit: pageSize, offset: 0 })
      .then((page) => {
        if (!mounted.current || current !== requestId.current) return;
        offset.current = page.length;
        setData(page);
        setExhausted(page.length < pageSize);
        setError(undefined);
        setLastUpdated(new Date());
      })
      .catch((caught: unknown) => {
        if (!mounted.current || current !== requestId.current) return;
        fail(caught);
      })
      .finally(() => {
        if (!mounted.current || current !== requestId.current) return;
        setLoading(false);
        setLoadingOlder(false);
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, pageSize]);

  const loadOlder = useCallback(() => {
    if (!enabled) return;
    const current = ++requestId.current;
    setLoading(true);
    setLoadingOlder(true);
    loadRef
      .current({ limit: pageSize, offset: offset.current })
      .then((page) => {
        if (!mounted.current || current !== requestId.current) return;
        offset.current += page.length;
        setData((held = []) => {
          const seen = new Set(held.map((row) => keyRef.current(row)));
          return [...held, ...page.filter((row) => !seen.has(keyRef.current(row)))];
        });
        setExhausted(page.length < pageSize);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!mounted.current || current !== requestId.current) return;
        fail(caught);
      })
      .finally(() => {
        if (!mounted.current || current !== requestId.current) return;
        setLoading(false);
        setLoadingOlder(false);
      });
  }, [enabled, pageSize]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, loaded, lastUpdated, refresh, exhausted, loadingOlder, loadOlder };
}
