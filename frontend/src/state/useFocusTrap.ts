/**
 * Holds keyboard focus inside an open dialog.
 *
 * The listener is bound to the container rather than the document so it cannot
 * interfere with anything else on the page, and it only ever acts on the moves
 * that would leave the dialog — inside it, the browser's own Tab ordering is
 * correct and reimplementing it would only introduce disagreements.
 */

import { useEffect, type RefObject } from "react";
import { nextFocusTarget, tabbableElements } from "../lib/focusTrap.ts";

export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const element = container.current;
    if (!element) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      // Recomputed per keystroke: the error banner, the sent receipt, and the
      // disabled state of Send all change the sequence while the dialog is open.
      const target = nextFocusTarget(
        tabbableElements(element),
        element.ownerDocument.activeElement,
        event.shiftKey,
      );
      if (!target) return;
      event.preventDefault();
      target.focus();
    };

    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [container, active]);
}
