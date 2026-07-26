/**
 * The single global broadcast entry point.
 *
 * The trigger lives in the persistent toolbar, so the composer must open over
 * whatever route is showing rather than navigating anywhere. That means the
 * open state, readiness, and focus-return target belong here rather than in
 * any one view.
 */

import { useCallback, useRef, useState } from "react";
import type { Agent } from "../api/contract.ts";
import { broadcastReadiness, type Readiness } from "../lib/broadcast.ts";

export interface BroadcastLauncher {
  open: boolean;
  readiness: Readiness;
  /** Null when a broadcast can be sent; otherwise the one reason it cannot. */
  disabledReason: string | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  /** Closes and returns focus to the toolbar trigger. */
  onClose: () => void;
  /** Increments on a successful send so Messages can refresh in place. */
  sentNonce: number;
  onSent: () => void;
}

export function useBroadcastLauncher(
  actor: Agent | undefined,
  sessionId: string | null,
  mutationsEnabled: boolean,
): BroadcastLauncher {
  const [open, setOpen] = useState(false);
  const [sentNonce, setSentNonce] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const readiness = broadcastReadiness({ actor, sessionId, mutationsEnabled });

  const onClose = useCallback(() => {
    setOpen(false);
    // Focus returns to the trigger, which is always present in the toolbar.
    triggerRef.current?.focus();
  }, []);

  return {
    open,
    readiness,
    disabledReason: readiness.kind === "blocked" ? readiness.reason : null,
    triggerRef,
    onOpen: useCallback(() => setOpen(true), []),
    onClose,
    sentNonce,
    onSent: useCallback(() => setSentNonce((value) => value + 1), []),
  };
}
