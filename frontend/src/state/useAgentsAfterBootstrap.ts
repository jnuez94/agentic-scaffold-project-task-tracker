/**
 * Refetch the agent list once bootstrap has settled.
 *
 * Bootstrap creates the local operator *after* the agent list is fetched, so on
 * a clean launch the list cannot contain it. Left stale, the actor selector
 * rendered with no options at all, and Broadcast told the operator to "select
 * an actor in the header" — from a list with nothing in it.
 *
 * Once, never in a loop: the latch is the point of this hook, and inlining it
 * put a mutable ref in App whose only job was to stop an effect repeating.
 */

import { useEffect, useRef } from "react";
import type { BootstrapPhase } from "./useBootstrap.ts";

export function useAgentsAfterBootstrap(
  phase: BootstrapPhase["kind"],
  refresh: () => void,
): void {
  const settled = useRef(false);

  useEffect(() => {
    if (phase !== "ready" || settled.current) return;
    settled.current = true;
    refresh();
  }, [phase, refresh]);
}
