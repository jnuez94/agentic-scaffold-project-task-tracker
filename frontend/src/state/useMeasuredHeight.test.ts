import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestResizeObserver } from "../test/setup.ts";
import { useMeasuredHeight } from "./useMeasuredHeight.ts";

function elementOfHeight(height: number): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ height }) as DOMRect;
  return element;
}

describe("useMeasuredHeight", () => {
  it("reports zero when there is no element to measure", () => {
    const { result } = renderHook(() => useMeasuredHeight({ current: null }));
    // Zero degrades to "both layers stick at the top", not to a gap.
    expect(result.current).toBe(0);
  });

  it("measures the element on mount", () => {
    const ref = { current: elementOfHeight(146) };
    const { result } = renderHook(() => useMeasuredHeight(ref));
    expect(result.current).toBe(146);
  });

  it("follows the element when it resizes", () => {
    const ref = { current: elementOfHeight(146) };
    const { result } = renderHook(() => useMeasuredHeight(ref));

    // The bar wraps at narrow widths; the offset has to follow it or the day
    // heading overlaps the controls.
    act(() => {
      TestResizeObserver.instances.at(-1)?.emit([{ borderBoxSize: [{ blockSize: 212, inlineSize: 0 }] }]);
    });
    expect(result.current).toBe(212);
  });

  it("uses the border box, not the content box", () => {
    // The heading stacks against the bar's outer edge, so padding and border
    // are part of the offset; contentRect would let it slide under them.
    const ref = { current: elementOfHeight(100) };
    const { result } = renderHook(() => useMeasuredHeight(ref));
    act(() => {
      TestResizeObserver.instances.at(-1)?.emit([{ borderBoxSize: [{ blockSize: 180, inlineSize: 0 }] }]);
    });
    expect(result.current).toBe(180);
  });

  it("falls back to the bounding rect when an entry reports no border box", () => {
    const ref = { current: elementOfHeight(146) };
    const { result } = renderHook(() => useMeasuredHeight(ref));
    act(() => {
      TestResizeObserver.instances.at(-1)?.emit([{ target: elementOfHeight(133) }]);
    });
    expect(result.current).toBe(133);
  });

  it("observes exactly the element it was given", () => {
    const element = elementOfHeight(146);
    renderHook(() => useMeasuredHeight({ current: element }));
    expect(TestResizeObserver.instances.at(-1)?.targets.has(element)).toBe(true);
  });

  it("stops observing when unmounted", () => {
    const element = elementOfHeight(146);
    const { unmount } = renderHook(() => useMeasuredHeight({ current: element }));
    const observer = TestResizeObserver.instances.at(-1);
    unmount();
    expect(observer?.targets.size).toBe(0);
  });

  it("still reports a height where ResizeObserver is unavailable", () => {
    // Older or restricted environments: a bar that never changes size must
    // still produce a correct offset rather than none.
    const original = globalThis.ResizeObserver;
    // @ts-expect-error removing it deliberately
    delete globalThis.ResizeObserver;
    try {
      const { result } = renderHook(() => useMeasuredHeight({ current: elementOfHeight(146) }));
      expect(result.current).toBe(146);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
