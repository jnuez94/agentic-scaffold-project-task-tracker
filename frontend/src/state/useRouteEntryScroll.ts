/**
 * Arriving on a route shows the top of it.
 *
 * `.content` is reused across routes, so without this its scrollTop simply
 * carried over and was clamped to the new route's maximum — land on a shorter
 * route after scrolling a long one and you arrived at its bottom, heading and
 * column headers off screen.
 *
 * Keyed on the route name, not the whole route: opening a task in the
 * inspector changes `route.detail` and must not yank the queue back to the
 * top. That distinction is the entire reason this is not a one-liner, which is
 * why it travels with its explanation rather than being inlined in App.
 */

import { useEffect, type RefObject } from "react";
import { ROUTE_ENTRY_SCROLL, type RouteName } from "./useHashRoute.ts";

export function useRouteEntryScroll(
  scroller: RefObject<HTMLElement | null>,
  routeName: RouteName,
): void {
  useEffect(() => {
    // Routes that keep their position say so in the table; the default is top.
    if (ROUTE_ENTRY_SCROLL[routeName] !== "top") return;
    if (scroller.current) scroller.current.scrollTop = 0;
    // `scroller` is declared even though a ref object is stable: depending on
    // it costs nothing and needs no suppression, and a suppression is a thing
    // that outlives the reason for it.
  }, [routeName, scroller]);
}
