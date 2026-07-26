import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * jsdom implements neither of these, and both are load-bearing rather than
 * decorative: the sticky orientation bar measures itself with ResizeObserver,
 * and "Jump to newest" scrolls with scrollTo. Left undefined, the components
 * under test would silently take their fallback paths and the tests would pass
 * without exercising the behaviour.
 *
 * The observer records its instances so a test can drive a resize; it does not
 * lay anything out, because jsdom has no layout to observe.
 */
class TestResizeObserver implements ResizeObserver {
  static instances: TestResizeObserver[] = [];
  readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  /** Drive a resize from a test. */
  emit(entries: Partial<ResizeObserverEntry>[]): void {
    this.callback(entries as ResizeObserverEntry[], this);
  }
}

globalThis.ResizeObserver = TestResizeObserver;
export { TestResizeObserver };

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {
    /* recorded by spies in tests; jsdom cannot scroll */
  };
}

afterEach(() => {
  cleanup();
  TestResizeObserver.instances.length = 0;
});
