/**
 * A draggable, keyboard-operable pane separator.
 *
 * Implemented as `role="separator"` with `aria-valuenow`, because a drag-only
 * resizer is unusable without a pointer. Arrow keys move the separator, Home
 * and End jump to the bounds, and double-click restores the default width —
 * so the feature works from the keyboard alone.
 *
 * `direction` is which way the pane grows when the separator moves right:
 * +1 for a pane on the left (the nav), -1 for a pane on the right (the
 * inspector).
 */

import { useCallback, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

const STEP = 16;
const COARSE_STEP = 64;

/**
 * Pointer capture is best-effort.
 *
 * It keeps pointermove flowing to the handle when the cursor outruns the
 * 7px hit area mid-drag, but it is not required for correctness and it is
 * absent or partial in some environments. Failing to capture must not break
 * the drag, so both calls are guarded.
 */
function capturePointer(element: Element, pointerId: number, capture: boolean): void {
  try {
    if (capture) {
      element.setPointerCapture?.(pointerId);
    } else if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture?.(pointerId);
    }
  } catch {
    // Nothing to recover: the drag still works through normal event flow.
  }
}

export interface ResizeHandleProps {
  label: string;
  value: number;
  min: number;
  max: number;
  direction: 1 | -1;
  onResize: (next: number) => void;
  onReset: () => void;
}

export function ResizeHandle({
  label,
  value,
  min,
  max,
  direction,
  onResize,
  onReset,
}: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // Ignore secondary buttons so a right-click cannot start a drag.
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { startX: event.clientX, startWidth: value };
      capturePointer(event.currentTarget, event.pointerId, true);
      document.body.classList.add("resizing");
    },
    [value],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state) return;
      const delta = (event.clientX - state.startX) * direction;
      onResize(state.startWidth + delta);
    },
    [direction, onResize],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    capturePointer(event.currentTarget, event.pointerId, false);
    document.body.classList.remove("resizing");
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? COARSE_STEP : STEP;
      let next: number | null = null;
      if (event.key === "ArrowLeft") next = value + -1 * direction * step;
      else if (event.key === "ArrowRight") next = value + direction * step;
      else if (event.key === "Home") next = direction === 1 ? min : max;
      else if (event.key === "End") next = direction === 1 ? max : min;
      else if (event.key === "Enter") {
        event.preventDefault();
        onReset();
        return;
      }
      if (next === null) return;
      event.preventDefault();
      onResize(next);
    },
    [direction, max, min, onReset, onResize, value],
  );

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}. Drag, or use arrow keys. Double-click to reset.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    >
      <span className="resize-grip" aria-hidden="true" />
    </div>
  );
}
