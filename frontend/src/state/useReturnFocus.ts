/**
 * Gives focus back to whatever opened a surface when it closes, on every
 * close path, because closing is unmounting (UI-78, UI-81). Called by each
 * dialog, inspector and inline form; they differ in what they show, not in
 * how they hand focus back.
 *
 * The opener is read during the first render, before the surface moves focus
 * to its own heading. An inspector that stays mounted while the operator
 * moves from one record to the next passes the record's id as `key`, so the
 * opener is read again for each record: closing returns to the row that
 * opened the record on screen, not the first one.
 *
 * Focus is restored after the close has committed: while the broadcast
 * composer is open the rest of the shell is `inert`, and focusing an inert
 * element silently does nothing. When it lands back on the opener, the hook
 * keeps watching for a moment, because the refresh an action triggers can
 * remove the opener it returned to.
 */

import { useEffect, useState } from "react";
import { captureFocusReturn, followOpenerRemoval, pressedControl, restoreFocus } from "../lib/returnFocus.ts";

// The control the last pointer press landed in. Safari does not focus a
// button on click, so for a mouse operator "what had focus" is not the
// opener; the press is. Read only within a moment of it, so an old click
// never names the opener of something reached another way.
const PRESS_WINDOW_MS = 1000;
let lastPress: { control: HTMLElement; at: number } | null = null;
document.addEventListener(
  "pointerdown",
  (event) => {
    const control = pressedControl(event.target);
    lastPress = control ? { control, at: performance.now() } : null;
  },
  true,
);

function recentPress(): HTMLElement | null {
  if (!lastPress || performance.now() - lastPress.at > PRESS_WINDOW_MS) return null;
  return lastPress.control.isConnected ? lastPress.control : null;
}

export function useReturnFocus(key?: unknown): void {
  // A box rather than state: the opener is read, not rendered, and the
  // unmount below must see the one read last.
  const [box] = useState(() => ({ key, target: captureFocusReturn(document, recentPress()) }));
  if (!Object.is(box.key, key)) {
    box.key = key;
    box.target = captureFocusReturn(document, recentPress());
  }
  useEffect(
    () => () => {
      queueMicrotask(() => {
        const landed = restoreFocus(box.target, document);
        // The opener may still leave with the change it made, once the
        // record refreshes; follow it rather than strand focus on the body.
        if (landed && landed === box.target.origin) followOpenerRemoval(box.target, document);
      });
    },
    [box],
  );
}
