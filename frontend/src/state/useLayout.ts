/**
 * Pane widths, clamped and persisted.
 */

import { useCallback, useMemo, useState } from "react";
import {
  browserLayoutStore,
  DEFAULT_WIDTHS,
  LayoutStore,
  type LayoutWidths,
  type Pane,
} from "./layoutStore.ts";

export interface Layout {
  widths: LayoutWidths;
  setWidth: (pane: Pane, value: number) => void;
  reset: (pane: Pane) => void;
}

export function useLayout(store: LayoutStore = browserLayoutStore()): Layout {
  const persisted = useMemo(() => store.load(), [store]);
  const [widths, setWidths] = useState<LayoutWidths>(persisted);

  const apply = useCallback(
    (pane: Pane, value: number) => {
      setWidths((current) => {
        const next = { ...current, [pane]: LayoutStore.clamp(pane, value) };
        store.save(next);
        return next;
      });
    },
    [store],
  );

  const reset = useCallback(
    (pane: Pane) => apply(pane, DEFAULT_WIDTHS[pane]),
    [apply],
  );

  return { widths, setWidth: apply, reset };
}
