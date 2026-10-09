/**
 * Gives focus back to whatever opened a dialog when the dialog closes, on
 * every close path, because closing is unmounting (UI-78). Called by each
 * dialog; the dialogs differ in their fields, not in how they hand focus back.
 *
 * The opener is read during the first render, before the dialog's own effect
 * moves focus to its heading. Focus is restored after the close has
 * committed: while the broadcast composer is open the rest of the shell is
 * `inert`, and focusing an inert element silently does nothing.
 */

import { useEffect, useState } from "react";
import { captureFocusReturn, restoreFocus } from "../lib/returnFocus.ts";

export function useReturnFocus(): void {
  const [target] = useState(() => captureFocusReturn(document));
  useEffect(
    () => () => {
      queueMicrotask(() => restoreFocus(target, document));
    },
    [target],
  );
}
