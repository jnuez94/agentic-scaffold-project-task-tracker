import { afterEach, describe, expect, it, vi } from "vitest";
import { guardOutsidePress } from "./outsidePress.ts";

function fire(node: Node, type: string) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  node.dispatchEvent(event);
  return event;
}

function press(node: Node) {
  const down = fire(node, "pointerdown");
  fire(node, "pointerup");
  const click = fire(node, "click");
  return { down, click };
}

function page() {
  const panel = document.createElement("div");
  const inner = document.createElement("button");
  const outside = document.createElement("button");
  panel.append(inner);
  document.body.append(panel, outside);
  const outsideClicks = vi.fn();
  outside.addEventListener("click", outsideClicks);
  return { panel, inner, outside, outsideClicks };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("guardOutsidePress", () => {
  it("leaves a press inside alone", () => {
    const { panel, inner } = page();
    const onOutside = vi.fn();
    const release = guardOutsidePress(document, (node) => panel.contains(node), onOutside);

    const { down, click } = press(inner);

    expect(onOutside).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(false);
    release();
  });

  it("spends an outside press on closing: cancelled, and its click never arrives", () => {
    const { panel, outside, outsideClicks } = page();
    const onOutside = vi.fn();
    const release = guardOutsidePress(document, (node) => panel.contains(node), onOutside, () => {});

    const { down, click } = press(outside);

    expect(onOutside).toHaveBeenCalledTimes(1);
    expect(down.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);
    expect(outsideClicks).not.toHaveBeenCalled();
    release();
  });

  it("swallows that click even after the guard itself is gone", () => {
    const { panel, outside, outsideClicks } = page();
    const release = guardOutsidePress(document, (node) => panel.contains(node), () => release(), () => {});

    press(outside);

    expect(outsideClicks).not.toHaveBeenCalled();
  });

  it("lets the next press through once the popover has closed", () => {
    const { panel, outside, outsideClicks } = page();
    const release = guardOutsidePress(document, (node) => panel.contains(node), () => release(), () => {});

    press(outside);
    press(outside);

    expect(outsideClicks).toHaveBeenCalledTimes(1);
  });

  it("disarms after a release that produced no click", () => {
    const { panel, outside, outsideClicks } = page();
    const deferred: (() => void)[] = [];
    const release = guardOutsidePress(
      document,
      (node) => panel.contains(node),
      () => release(),
      (run) => void deferred.push(run),
    );

    fire(outside, "pointerdown");
    fire(outside, "pointerup");
    deferred.forEach((run) => run());
    fire(outside, "click");

    expect(outsideClicks).toHaveBeenCalledTimes(1);
  });
});
