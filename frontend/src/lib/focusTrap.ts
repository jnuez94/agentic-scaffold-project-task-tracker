/**
 * Working out where Tab should go inside a modal.
 *
 * `aria-modal="true"` is a promise to assistive technology that the rest of the
 * page is unavailable. The broadcast dialog made that promise while Tab walked
 * straight out into the navigation behind it, so a keyboard or screen-reader
 * operator could be editing a draft and land on a route link with no indication
 * they had left the dialog.
 *
 * Kept as pure functions over a container element: the ordering rules are the
 * part worth testing, and they are hard to see through an event listener.
 */

/**
 * Deliberately not `[tabindex]:not([tabindex="-1"])` alone — the dialog heading
 * carries `tabindex="-1"` so it can receive focus programmatically without
 * joining the Tab cycle, which is exactly the distinction this encodes.
 */
const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Whether an element is available to the Tab sequence right now. */
export function isTabbable(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false;
  // `hidden` anywhere above it removes it from the sequence too.
  if (element.closest("[hidden]")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.tabIndex < 0) return false;
  return true;
}

/**
 * The dialog's Tab sequence, in document order.
 *
 * Queried fresh on every call rather than cached, because the set changes while
 * the dialog is open: an error banner adds a dismiss button, the sent receipt
 * appears, and Send is disabled for the duration of a submit. A cached list
 * would trap focus against controls that no longer exist.
 */
export function tabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(isTabbable);
}

/**
 * Where Tab (or Shift+Tab) should land, or null to let the browser handle it.
 *
 * Returns a target only when the move would otherwise leave the container:
 * inside it, the browser's own sequencing is already correct and better than
 * anything reimplemented here.
 */
export function nextFocusTarget(
  elements: readonly HTMLElement[],
  current: Element | null,
  backwards: boolean,
): HTMLElement | null {
  if (elements.length === 0) return null;

  const first = elements[0]!;
  const last = elements[elements.length - 1]!;

  // Focus somewhere in the dialog but outside the cycle — the heading, which
  // is where focus starts. Tab enters the sequence, Shift+Tab wraps to the end.
  const index = current ? elements.indexOf(current as HTMLElement) : -1;
  if (index === -1) return backwards ? last : first;

  if (backwards && current === first) return last;
  if (!backwards && current === last) return first;
  return null;
}
