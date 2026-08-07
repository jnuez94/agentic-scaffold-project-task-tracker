/**
 * Noticing that the board moved under the operator (UI-34).
 *
 * Michael's ruling, applied as given: poll every sixty seconds, gated on
 * document.visibilityState, and skip while a mutation dialog is open — because
 * refreshing rows under a half-composed reassignment is the failure this is
 * meant to prevent, not cause.
 *
 * Sixty because the thing being detected is another agent landing a change,
 * which happens on a scale of minutes, and because each poll costs a
 * subprocess on this backend. Polling rather than a change feed because SSE
 * would need a new endpoint, which the task forbids, and would be
 * over-engineering for a loopback console.
 *
 * This never mutates what is on screen. It reports that the two differ and
 * leaves refreshing to the operator: replacing rows underneath someone is the
 * behaviour being complained about.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { describeDelta, diffBoards, fingerprint, type Versioned } from "../lib/fingerprint.ts";

export const POLL_INTERVAL_MS = 60_000;

export interface BoardWatch {
  /** Empty when the board is current; otherwise what changed, in words. */
  summary: string;
  /** Clears the notice — call after the operator refreshes. */
  dismiss: () => void;
}

/**
 * A mutation dialog is open somewhere on the page.
 *
 * Read from the DOM rather than threaded through props deliberately: every
 * dialog in the console already carries `role="dialog"`, and the alternative is
 * a boolean that every future dialog must remember to set. A missed flag here
 * means polling under a half-typed form, which is the exact failure being
 * avoided, so the check that cannot be forgotten is the safer one.
 */
function dialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

export function useBoardWatch(
  load: () => Promise<Versioned[]>,
  current: readonly Versioned[] | undefined,
  options: { intervalMs?: number; enabled?: boolean } = {},
): BoardWatch {
  const { intervalMs = POLL_INTERVAL_MS, enabled = true } = options;
  const [summary, setSummary] = useState("");

  // The displayed set, read inside the interval without restarting it. A
  // dependency on `current` would reset the timer on every refresh, so a board
  // that refreshes often would never complete a polling period.
  const displayed = useRef<readonly Versioned[]>(current ?? []);
  displayed.current = current ?? [];

  const loader = useRef(load);
  loader.current = load;

  const dismiss = useCallback(() => setSummary(""), []);

  // Anything the operator does to the board makes the notice stale, so it is
  // cleared whenever what is displayed matches what was last fetched.
  const lastSeen = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      if (dialogOpen()) return;
      try {
        const fresh = await loader.current();
        if (cancelled) return;
        const shown = displayed.current;
        if (fingerprint(fresh) === fingerprint(shown)) {
          setSummary("");
          lastSeen.current = "";
          return;
        }
        const words = describeDelta(diffBoards(shown, fresh));
        if (words && words !== lastSeen.current) {
          lastSeen.current = words;
          setSummary(words);
        }
      } catch {
        // A failed poll is not worth reporting: the operator did not ask for
        // it, and the surface it would use is the one reserved for real news.
      }
    };

    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);

  return { summary, dismiss };
}
