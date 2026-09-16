/**
 * Noticing that the board moved under the operator (UI-34, re-based on the
 * audit cursor in UI-75).
 *
 * Michael's ruling, applied as given: poll every sixty seconds, gated on
 * document.visibilityState, and skip while a mutation dialog is open — because
 * refreshing rows under a half-composed reassignment is the failure this is
 * meant to prevent, not cause.
 *
 * What is polled changed. The watch used to refetch the task list and diff
 * revisions; 1.4.0 gives a cheaper and more honest signal. `summary --section
 * totals` returns `audit_cursor`, the head of the ledger, in one small call.
 * When it moves past the cursor the view loaded at, `audit list --since` names
 * exactly what changed and who changed it — every record kind, not just tasks
 * — and heartbeats are left out so a live session cannot keep the marker lit.
 *
 * This never mutates what is on screen. It reports that the board moved and
 * leaves refreshing to the operator: replacing rows underneath someone is the
 * behaviour being complained about.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEntry } from "../api/contract.ts";
import { describeAuditChanges } from "../lib/boardChanges.ts";

export const POLL_INTERVAL_MS = 60_000;

export interface BoardWatchSource {
  /** The ledger's head: `summary --section totals`, read for `audit_cursor`. */
  head: () => Promise<number>;
  /** What was recorded after a cursor: `audit list --since`. */
  changes: (since: number) => Promise<AuditEntry[]>;
}

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
  source: BoardWatchSource,
  /** The displayed data; a new value means the operator refreshed, and the watch re-anchors. */
  anchor: unknown,
  options: { intervalMs?: number; enabled?: boolean } = {},
): BoardWatch {
  const { intervalMs = POLL_INTERVAL_MS, enabled = true } = options;
  const [summary, setSummary] = useState("");

  const sourceRef = useRef(source);
  sourceRef.current = source;
  // The cursor the displayed data is current to. Null until the head has been
  // read once for this anchor; a poll before then compares against nothing.
  const baseline = useRef<number | null>(null);
  const lastSeen = useRef<number | null>(null);

  // Re-anchor on every refresh: what is displayed is current as of now, so
  // the notice clears and the next comparison starts from the present head.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    baseline.current = null;
    setSummary("");
    sourceRef.current
      .head()
      .then((head) => {
        if (!cancelled) baseline.current = head;
      })
      .catch(() => {
        // Without a baseline the watch stays quiet until the next refresh.
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, enabled]);

  const dismiss = useCallback(() => {
    setSummary("");
    // Dismissed means "I know": the same changes should not light it again.
    if (lastSeen.current !== null) baseline.current = lastSeen.current;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      if (dialogOpen()) return;
      if (baseline.current === null) return;
      try {
        const head = await sourceRef.current.head();
        if (cancelled) return;
        if (head <= baseline.current) {
          setSummary("");
          return;
        }
        const entries = await sourceRef.current.changes(baseline.current);
        if (cancelled) return;
        lastSeen.current = head;
        setSummary(describeAuditChanges(entries));
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
