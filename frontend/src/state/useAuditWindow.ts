/**
 * The audit log as a window that grows backwards (UI-64).
 *
 * `useResource` holds one value and replaces it on refresh, which is right
 * for every other list. The audit log is read by scrolling back: the newest
 * page first, then the page before it, appended, until a page comes back
 * short and the beginning of the log has been reached. Each older page is
 * asked for by cursor — the oldest id already held — so nothing is skipped
 * or repeated when the log grows underneath the operator.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEntry } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";

/** A type literal rather than an interface, so it satisfies the client's Query index signature. */
export type AuditQuery = { limit: number; before?: number; [param: string]: string | number | undefined };

export interface AuditWindow {
  rows: AuditEntry[];
  error: ApiError | undefined;
  /** Any request in flight, initial or older. */
  loading: boolean;
  /** Set once the first load settles, so the view can tell empty from pending. */
  loaded: boolean;
  /** The last page came back short: there is nothing older to load. */
  exhausted: boolean;
  /**
   * Which request the held rows answer, as the params' JSON. Changes only
   * when a fresh window lands, so a view can react to "a reload finished"
   * rather than guessing from loading flags that flip across renders.
   */
  windowKey: string;
  loadOlder: () => void;
  /** Back to the newest window, discarding what was loaded behind it. */
  refresh: () => void;
}

/**
 * `params` are the request's own narrowing — the pickers. A change starts a
 * fresh window: one request, rows replaced rather than appended, and the
 * exhausted flag reset with them.
 */
export function useAuditWindow(
  load: (query: AuditQuery) => Promise<AuditEntry[]>,
  pageSize: number,
  params: Record<string, string> = {},
): AuditWindow {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [windowKey, setWindowKey] = useState("");

  const loadRef = useRef(load);
  loadRef.current = load;
  // Compared by value: a new object with the same pickers is the same window.
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // A slow earlier request must not land on top of a newer one.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    (before?: number) => {
      const current = ++requestId.current;
      setLoading(true);
      const query: AuditQuery = { ...paramsRef.current, limit: pageSize };
      const key = JSON.stringify(paramsRef.current);
      if (before !== undefined) query.before = before;
      loadRef
        .current(query)
        .then((page) => {
          if (!mounted.current || current !== requestId.current) return;
          setRows((previous) => (before === undefined ? page : [...previous, ...page]));
          setExhausted(page.length < pageSize);
          setError(undefined);
          if (before === undefined) setWindowKey(key);
        })
        .catch((caught: unknown) => {
          if (!mounted.current || current !== requestId.current) return;
          setError(
            caught instanceof ApiError
              ? caught
              : new ApiError("network_error", describeThrown(caught), 0),
          );
        })
        .finally(() => {
          if (!mounted.current || current !== requestId.current) return;
          setLoading(false);
          setLoaded(true);
        });
    },
    [pageSize],
  );

  useEffect(() => {
    run();
  }, [run, paramsKey]);

  const loadOlder = useCallback(() => {
    const oldest = rowsRef.current[rowsRef.current.length - 1];
    if (!oldest) return;
    run(oldest.id);
  }, [run]);

  const refresh = useCallback(() => run(), [run]);

  return { rows, error, loading, loaded, exhausted, windowKey, loadOlder, refresh };
}
