/**
 * The single global broadcast entry point.
 *
 * The trigger lives in the persistent toolbar, so the composer must open over
 * whatever route is showing rather than navigating anywhere. That means the
 * open state and readiness belong here rather than in any one view. Focus
 * return is the composer's own, as it is for every dialog (UI-78).
 */

import { useCallback, useState } from "react";
import type { Agent } from "../api/contract.ts";
import { broadcastReadiness, type Readiness } from "../lib/broadcast.ts";

export interface BroadcastLauncher {
  open: boolean;
  readiness: Readiness;
  /** Null when a broadcast can be sent; otherwise the one reason it cannot. */
  disabledReason: string | null;
  onOpen: () => void;
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

  const readiness = broadcastReadiness({ actor, sessionId, mutationsEnabled });

  const onClose = useCallback(() => setOpen(false), []);

  return {
    open,
    readiness,
    disabledReason: readiness.kind === "blocked" ? readiness.reason : null,
    onOpen: useCallback(() => setOpen(true), []),
    onClose,
    sentNonce,
    onSent: useCallback(() => setSentNonce((value) => value + 1), []),
  };
}
