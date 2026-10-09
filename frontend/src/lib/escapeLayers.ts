/**
 * Which open layer a press of Escape belongs to.
 *
 * Inspectors, sheets and the broadcast composer all close on Escape, and
 * several can be open at once: a sheet over an inspector over a list. Each
 * used to listen on the document, so one press reached every layer in the
 * order they registered. The inspector, registered first, closed and
 * navigated, and the re-render that caused dropped the sheet's listener
 * before it ran — the sheet stayed open over a list with nothing under it.
 *
 * A stack in opening order hands the press to the newest layer alone. The
 * layers beneath see nothing until it closes, and a layer that declines to
 * close (a sheet mid-request) still holds the key: Escape never reaches past
 * the layer the operator is looking at.
 */

export type EscapeLayer = { close: () => void };

type KeyTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type EscapeStack = {
  /** Opens a layer on top; the returned function removes it, wherever it sits. */
  push: (layer: EscapeLayer) => () => void;
  /** How many layers are open, for tests and nothing else. */
  depth: () => number;
};

export function createEscapeStack(target: KeyTarget): EscapeStack {
  const layers: EscapeLayer[] = [];

  const onKeyDown = (event: Event) => {
    // A control that handled Escape itself (an open picker) has used the press.
    if ((event as KeyboardEvent).key !== "Escape" || event.defaultPrevented) return;
    layers[layers.length - 1]?.close();
  };

  return {
    push(layer) {
      if (layers.length === 0) target.addEventListener("keydown", onKeyDown);
      layers.push(layer);
      return () => {
        const index = layers.indexOf(layer);
        if (index === -1) return;
        layers.splice(index, 1);
        if (layers.length === 0) target.removeEventListener("keydown", onKeyDown);
      };
    },
    depth: () => layers.length,
  };
}
