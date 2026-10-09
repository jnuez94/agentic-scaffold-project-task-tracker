/**
 * Closes a layer on Escape when it is the newest one open.
 *
 * The layer joins the shared stack when it mounts (or, for a layer that stays
 * mounted and only shows and hides, when it becomes `active`) and leaves when
 * it unmounts or hides. Its place is therefore its opening order, not whenever
 * it last re-rendered. The handler is read at the moment of the press, so a
 * sheet's "not while a request is pending" check sees the current value.
 */

import { useEffect, useRef } from "react";
import { createEscapeStack } from "../lib/escapeLayers.ts";

const layers = createEscapeStack(document);

export function useEscape(close: () => void, active = true): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!active) return;
    return layers.push({ close: () => latest.current() });
  }, [active]);
}
