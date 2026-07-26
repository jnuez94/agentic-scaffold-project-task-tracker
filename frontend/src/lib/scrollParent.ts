/**
 * Finding the element that actually scrolls a node.
 *
 * Components that anchor scroll position cannot assume they own a scroller.
 * The console deliberately keeps one scroll region per column, so a view is
 * usually scrolled by an ancestor rather than by itself, and that ancestor can
 * change with the breakpoint.
 */

export function getScrollParent(node: Element | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (/(auto|scroll)/.test(overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/** Distance in px from the bottom of a scroller. */
export function distanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}
