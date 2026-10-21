/**
 * Where focus goes when a dialog, an inspector or an inline form closes
 * (UI-78, UI-81).
 *
 * Closing used to drop focus on the document body, so a keyboard or
 * screen-reader operator landed at the top of the page with no announcement
 * and tabbed back through the navigation to resume. Focus now goes back to
 * the control that opened the surface. When that control went with the state
 * it changed it goes to its successor — the control rendered again under the
 * same id, as "Add evidence" is once its form closes — and failing that to
 * the nearest heading of the region the control sat in, which for an
 * inspector is the record's own title, and then the page heading. Never the
 * body while a heading exists to take it.
 *
 * Only lost focus is restored. If focus already sits on a live control when
 * the surface closes — the operator pressed "File a task" or a navigation
 * link, which closed the inspector by replacing it — that choice stands.
 */

const REGIONS = "aside, section, [role='region'], main";
const HEADINGS = "h1, h2, h3";

export interface FocusReturn {
  /** The control that opened the surface. */
  origin: HTMLElement | null;
  /** Its id, to find the control rendered again in its place. */
  originId: string | null;
  /** The heading to fall back to, found while the origin still existed. */
  anchor: HTMLElement | null;
}

/**
 * Read as the surface opens, before it moves focus to its own heading.
 * `pressed` is the control a pointer pressed a moment ago, for browsers that
 * do not focus a button on click (Safari): without it, a mouse operator's
 * opener would read as "nothing had focus".
 */
export function captureFocusReturn(doc: Document, pressed: HTMLElement | null = null): FocusReturn {
  const active = doc.activeElement;
  const focused = active instanceof HTMLElement && active !== doc.body ? active : null;
  const origin = focused ?? pressed;
  return { origin, originId: origin?.id || null, anchor: origin ? nearestHeading(origin) : null };
}

function nearestHeading(from: HTMLElement): HTMLElement | null {
  let region = from.closest(REGIONS);
  while (region) {
    const heading = region.querySelector<HTMLElement>(HEADINGS);
    if (heading) return heading;
    region = region.parentElement?.closest(REGIONS) ?? null;
  }
  return null;
}

/** Focus was lost: nothing holds it, or what held it has left the page. */
export function focusIsLost(doc: Document): boolean {
  const active = doc.activeElement;
  return !active || active === doc.body || !active.isConnected;
}

/**
 * Focuses the origin if it is still on the page and can take focus, else its
 * successor by id, else the anchor, else the page's main heading — but only
 * when focus was lost. Returns where focus landed, or null when it was left
 * alone or nothing could take it.
 */
export function restoreFocus(target: FocusReturn, doc: Document): HTMLElement | null {
  if (!focusIsLost(doc)) return null;
  const successor = target.originId ? doc.getElementById(target.originId) : null;
  const page = doc.querySelector<HTMLElement>("main h1") ?? doc.querySelector<HTMLElement>("h1");
  for (const candidate of [target.origin, successor, target.anchor, page]) {
    if (!candidate?.isConnected) continue;
    // A heading takes focus only with a tabindex; -1 keeps it out of the Tab order.
    if (candidate.matches(HEADINGS) && !candidate.hasAttribute("tabindex")) candidate.tabIndex = -1;
    candidate.focus();
    if (doc.activeElement === candidate) return candidate;
  }
  return null;
}

const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";

/** The focusable control a press landed in, if any. */
export function pressedControl(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? (target.closest<HTMLElement>(FOCUSABLE) ?? null) : null;
}

/**
 * Follows the opener for a moment after focus went back to it. An action can
 * remove its own opener once the record refreshes — "Resolve…" leaves with
 * the open status it answered — and the refresh lands after the surface has
 * closed and focus has already returned. If the opener leaves while focus is
 * still lost to it, focus moves on to its successor, its heading or the page
 * heading. Stops on its own after `windowMs`. Returns the stop function.
 */
export function followOpenerRemoval(target: FocusReturn, doc: Document, windowMs = 3000): () => void {
  const origin = target.origin;
  if (!origin) return () => {};
  const observer = new MutationObserver(() => {
    if (origin.isConnected) return;
    stop();
    restoreFocus({ ...target, origin: null }, doc);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  const timer = setTimeout(stop, windowMs);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
  }
  return stop;
}
