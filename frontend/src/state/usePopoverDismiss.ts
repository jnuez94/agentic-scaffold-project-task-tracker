/**
 * The ways a popover closes besides its own trigger (UI-77): Escape, which
 * returns focus to the trigger, and a press outside it, which is spent on
 * closing and reaches nothing beneath. Both are live only while it is open.
 *
 * Focus goes back to the trigger after an outside press only when it was
 * inside the popover: the popover hides, and a focused control that hides
 * leaves focus on the document body.
 */

import { useEffect, useRef, type RefObject } from "react";
import { guardOutsidePress } from "../lib/outsidePress.ts";
import { useEscape } from "./useEscape.ts";

export function usePopoverDismiss({
  open,
  onClose,
  panel,
  trigger,
}: {
  open: boolean;
  onClose: () => void;
  panel: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLElement | null>;
}): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  useEscape(() => {
    latest.current();
    trigger.current?.focus();
  }, open);

  useEffect(() => {
    if (!open) return;
    const inside = (node: Node) =>
      Boolean(panel.current?.contains(node) || trigger.current?.contains(node));
    return guardOutsidePress(document, inside, () => {
      const hadFocus = panel.current?.contains(document.activeElement) ?? false;
      latest.current();
      if (hadFocus) trigger.current?.focus();
    });
  }, [open, panel, trigger]);
}
