/**
 * A press outside a popover closes it and does nothing else (UI-77).
 *
 * The identity popover sat over page content and closed only from its own
 * readout, so a press aimed at the page beneath went through to whatever was
 * there — once it landed on the padding beside End session instead of the
 * inbox action it was meant for. Closing on an outside press is half the fix;
 * the other half is that the press is spent on closing. It is cancelled at
 * pointerdown, which keeps it from focusing, selecting or opening anything,
 * and the click that follows is swallowed before the page sees it.
 *
 * The click arrives after the close has re-rendered and torn this guard
 * down, so the swallow is armed per press rather than tied to the popover's
 * lifetime, and disarms itself once the press ends whether or not a click
 * followed — a press dragged off and released elsewhere never produces one.
 */

type PressTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Defer = (run: () => void) => void;

const nextTask: Defer = (run) => {
  setTimeout(run, 0);
};

export function guardOutsidePress(
  target: PressTarget,
  isInside: (node: Node) => boolean,
  onOutside: () => void,
  defer: Defer = nextTask,
): () => void {
  const onPointerDown = (event: Event) => {
    const node = event.target;
    if (!(node instanceof Node) || isInside(node)) return;
    event.preventDefault();
    event.stopPropagation();
    swallowFollowingClick(target, defer);
    onOutside();
  };
  target.addEventListener("pointerdown", onPointerDown, true);
  return () => target.removeEventListener("pointerdown", onPointerDown, true);
}

function swallowFollowingClick(target: PressTarget, defer: Defer): void {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  // A click, when there is one, is dispatched in the same task as the
  // release; deferring the disarm past that task lets it be caught first.
  const onRelease = () => defer(disarm);
  function disarm() {
    target.removeEventListener("click", swallow, true);
    target.removeEventListener("pointerup", onRelease, true);
    target.removeEventListener("pointercancel", onRelease, true);
  }
  target.addEventListener("click", swallow, true);
  target.addEventListener("pointerup", onRelease, true);
  target.addEventListener("pointercancel", onRelease, true);
}
