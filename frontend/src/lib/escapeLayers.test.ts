import { describe, expect, it, vi } from "vitest";
import { createEscapeStack } from "./escapeLayers.ts";

function press(target: EventTarget, key = "Escape", prevented = false) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  if (prevented) event.preventDefault();
  target.dispatchEvent(event);
}

describe("createEscapeStack", () => {
  it("hands Escape to the newest layer alone", () => {
    const target = new EventTarget();
    const stack = createEscapeStack(target);
    const inspector = vi.fn();
    const sheet = vi.fn();
    stack.push({ close: inspector });
    stack.push({ close: sheet });

    press(target);

    expect(sheet).toHaveBeenCalledTimes(1);
    expect(inspector).not.toHaveBeenCalled();
  });

  it("gives the key back to the layer beneath once the top one is removed", () => {
    const target = new EventTarget();
    const stack = createEscapeStack(target);
    const inspector = vi.fn();
    stack.push({ close: inspector });
    const removeSheet = stack.push({ close: vi.fn() });

    removeSheet();
    press(target);

    expect(inspector).toHaveBeenCalledTimes(1);
  });

  it("removes a layer from the middle without disturbing the order", () => {
    const target = new EventTarget();
    const stack = createEscapeStack(target);
    const removeMiddle = stack.push({ close: vi.fn() });
    const top = vi.fn();
    stack.push({ close: vi.fn() });
    stack.push({ close: top });

    removeMiddle();
    removeMiddle();
    press(target);

    expect(stack.depth()).toBe(2);
    expect(top).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys and a press a control already handled", () => {
    const target = new EventTarget();
    const stack = createEscapeStack(target);
    const close = vi.fn();
    stack.push({ close });

    press(target, "Enter");
    press(target, "Escape", true);

    expect(close).not.toHaveBeenCalled();
  });

  it("listens only while a layer is open", () => {
    const target = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    const stack = createEscapeStack(target);

    const first = stack.push({ close: vi.fn() });
    const second = stack.push({ close: vi.fn() });
    expect(add).toHaveBeenCalledTimes(1);

    first();
    second();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
