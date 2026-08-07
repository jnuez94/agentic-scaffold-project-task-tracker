/**
 * Announcing a page change the operator asked for, and only that.
 *
 * The pagination range was a permanently live region, so it re-announced every
 * time the row count changed — including on the refresh that every mutation
 * triggers. That is what buried mutation confirmations (UI-32): the operator
 * heard "Showing 1-10 of 61 loaded" instead of the result of the write they
 * had just made.
 *
 * Deleting the live region outright would have been the easy fix and a real
 * regression: a screen-reader operator who presses Next keeps focus on the
 * button, and without an announcement nothing tells them the page moved. So
 * the range still announces — but only when the change came from the operator
 * working the pager, never when it came from data arriving underneath them.
 */

import { useEffect, useRef, useState } from "react";

export function usePagingAnnouncement(label: string): [string, () => void] {
  const requested = useRef(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (requested.current) {
      requested.current = false;
      setMessage(label);
      return;
    }
    // Cleared rather than left standing: a stale range in a live region is
    // re-announced by some screen readers when focus next enters it.
    setMessage("");
  }, [label]);

  return [message, () => void (requested.current = true)];
}
