/**
 * Server state loading.
 *
 * Server state is the only state the console has, so a small hook covers it
 * and no state library is needed. Refreshing keeps the previous value visible
 * rather than blanking the view, which is what the UX spec asks for.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/errors.ts";
import { describeThrown } from "../lib/copy.ts";

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Set once the first load settles, so views can distinguish empty vs pending. */
  loaded: boolean;
  lastUpdated: Date | undefined;
  refresh: () => void;
}

export function useResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): Resource<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  // Guards against a slow earlier request overwriting a newer result.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    const current = ++requestId.current;
    setLoading(true);
    loadRef
      .current()
      .then((value) => {
        if (!mounted.current || current !== requestId.current) return;
        setData(value);
        setError(undefined);
        setLastUpdated(new Date());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, loaded, lastUpdated, refresh };
}

