import { describe, expect, it, vi } from "vitest";
import { distanceFromBottom, getScrollParent, scrollToBottom } from "./scrollParent.ts";

function makeScroller(scrollHeight: number, clientHeight: number, overflowY = "auto") {
  const el = document.createElement("div");
  el.style.overflowY = overflowY;
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  return el;
}

describe("getScrollParent", () => {
  it("returns null when nothing above scrolls", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(getScrollParent(child)).toBeNull();
    parent.remove();
  });

  it("finds an overflowing ancestor", () => {
    const scroller = makeScroller(1000, 400);
    const child = document.createElement("div");
    scroller.appendChild(child);
    document.body.appendChild(scroller);
    expect(getScrollParent(child)).toBe(scroller);
    scroller.remove();
  });

  it("ignores an ancestor that can scroll but has nothing to scroll", () => {
    // overflow:auto alone is not a scroller; the content must exceed the box.
    const notScrolling = makeScroller(400, 400);
    const child = document.createElement("div");
    notScrolling.appendChild(child);
    document.body.appendChild(notScrolling);
    expect(getScrollParent(child)).toBeNull();
    notScrolling.remove();
  });

  it("ignores overflow:visible ancestors", () => {
    const visible = makeScroller(1000, 400, "visible");
    const child = document.createElement("div");
    visible.appendChild(child);
    document.body.appendChild(visible);
    expect(getScrollParent(child)).toBeNull();
    visible.remove();
  });

  it("returns the nearest scroller when several are nested", () => {
    const outer = makeScroller(2000, 400);
    const inner = makeScroller(1000, 300);
    const child = document.createElement("div");
    inner.appendChild(child);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(getScrollParent(child)).toBe(inner);
    outer.remove();
  });

  it("handles a null node", () => {
    expect(getScrollParent(null)).toBeNull();
  });
});

describe("distanceFromBottom", () => {
  it("is zero at the bottom", () => {
    const el = makeScroller(1000, 400);
    el.scrollTop = 600;
    expect(distanceFromBottom(el)).toBe(0);
  });

  it("is the full overflow at the top", () => {
    const el = makeScroller(1000, 400);
    el.scrollTop = 0;
    expect(distanceFromBottom(el)).toBe(600);
  });
});

describe("scrollToBottom", () => {
  it("scrolls to the very bottom, smoothly", () => {
    const el = makeScroller(1000, 400);
    const spy = vi.fn();
    el.scrollTo = spy;
    scrollToBottom(el);
    expect(spy).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
  });

  it("jumps instead of animating when motion is reduced", () => {
    // A transcript can be thousands of pixels tall, which is exactly the
    // animation this preference exists to suppress.
    const el = makeScroller(9000, 400);
    const spy = vi.fn();
    el.scrollTo = spy;
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) =>
      ({ matches: query.includes("reduce") })) as typeof globalThis.matchMedia;
    try {
      scrollToBottom(el);
    } finally {
      globalThis.matchMedia = original;
    }
    expect(spy).toHaveBeenCalledWith({ top: 9000, behavior: "auto" });
  });

  it("does not require matchMedia to exist", () => {
    const el = makeScroller(1000, 400);
    const spy = vi.fn();
    el.scrollTo = spy;
    const original = globalThis.matchMedia;
    // @ts-expect-error deliberately removing it to prove the guard holds
    delete globalThis.matchMedia;
    try {
      scrollToBottom(el);
    } finally {
      globalThis.matchMedia = original;
    }
    expect(spy).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
  });
});
