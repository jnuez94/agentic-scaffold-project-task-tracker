/**
 * Where focus goes when a dialog closes (UI-78).
 *
 * Three of the four dialogs dropped focus on the document body when they
 * closed, so a keyboard or screen-reader operator landed at the top of the
 * page with no announcement and tabbed back through the navigation to
 * resume. Focus now goes back to the control that opened the dialog. When
 * that control went with the state it changed — a recovered session's row
 * leaves the stale list — it goes to the nearest heading of the region the
 * control sat in, which for an inspector is the record's own title. Never
 * to the body while a heading exists to take it.
 */

const REGIONS = "aside, section, [role='region'], main";
const HEADINGS = "h1, h2, h3";

export interface FocusReturn {
  /** The control that had focus as the dialog opened. */
  origin: HTMLElement | null;
  /** The heading to fall back to, found while the origin still existed. */
  anchor: HTMLElement | null;
}

/** Read as the dialog opens, before it moves focus to its own heading. */
export function captureFocusReturn(doc: Document): FocusReturn {
  const active = doc.activeElement;
  const origin = active instanceof HTMLElement && active !== doc.body ? active : null;
  return { origin, anchor: origin ? nearestHeading(origin) : null };
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

/**
 * Focuses the origin if it is still on the page and can take focus, else the
 * anchor, else the page's main heading. Returns where focus landed, or null
 * when none of them could take it.
 */
export function restoreFocus(target: FocusReturn, doc: Document): HTMLElement | null {
  const page = doc.querySelector<HTMLElement>("main h1") ?? doc.querySelector<HTMLElement>("h1");
  for (const candidate of [target.origin, target.anchor, page]) {
    if (!candidate?.isConnected) continue;
    // A heading takes focus only with a tabindex; -1 keeps it out of the Tab order.
    if (candidate.matches(HEADINGS) && !candidate.hasAttribute("tabindex")) candidate.tabIndex = -1;
    candidate.focus();
    if (doc.activeElement === candidate) return candidate;
  }
  return null;
}
