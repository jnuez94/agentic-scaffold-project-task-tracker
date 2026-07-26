/**
 * The live height of an element, for stacking one sticky layer under another.
 *
 * Two things stick to the top of the Messages scroll region: the orientation
 * bar, and the day heading beneath it. The heading's `top` therefore has to be
 * the bar's height, and that height is not a constant — the bar wraps at narrow
 * widths and grows at large text sizes, which is exactly when getting it wrong
 * hides content. Measuring is the only honest option; a hard-coded offset would
 * be correct at one viewport and one zoom level.
 *
 * Returns 0 until measured, which degrades to "both stick at the top" rather
 * than to a gap or an overlap.
 */

import { useEffect, useState, type RefObject } from "react";

export function useMeasuredHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Set the initial value even where ResizeObserver is unavailable, so the
    // offset is right for the common case of a bar that never changes size.
    setHeight(element.getBoundingClientRect().height);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // borderBoxSize is the sticky-relevant box; contentRect excludes the
        // padding and border the heading would then scroll underneath.
        const box = entry.borderBoxSize?.[0];
        setHeight(box ? box.blockSize : entry.target.getBoundingClientRect().height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}
