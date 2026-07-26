import { describe, expect, it } from "vitest";
import { isTabbable, nextFocusTarget, tabbableElements } from "./focusTrap.ts";

function dialog(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe("tabbableElements", () => {
  it("collects controls in document order", () => {
    const container = dialog(`
      <button id="close">Close</button>
      <textarea id="body"></textarea>
      <input id="task" />
      <button id="send">Send</button>
    `);
    expect(tabbableElements(container).map((e) => e.id)).toEqual([
      "close",
      "body",
      "task",
      "send",
    ]);
  });

  it("skips disabled controls", () => {
    // Send is disabled for the duration of a submit; Tab must not stop there.
    const container = dialog(`
      <button id="close">Close</button>
      <button id="send" disabled>Sending…</button>
      <button id="cancel">Cancel</button>
    `);
    expect(tabbableElements(container).map((e) => e.id)).toEqual(["close", "cancel"]);
  });

  it("excludes the heading, which is focusable but not in the Tab cycle", () => {
    const container = dialog(`
      <h2 id="heading" tabindex="-1">Broadcast to team</h2>
      <button id="close">Close</button>
    `);
    expect(tabbableElements(container).map((e) => e.id)).toEqual(["close"]);
  });

  it("skips hidden subtrees", () => {
    const container = dialog(`
      <button id="close">Close</button>
      <div hidden><button id="buried">Buried</button></div>
    `);
    expect(tabbableElements(container).map((e) => e.id)).toEqual(["close"]);
  });

  it("skips aria-hidden controls", () => {
    const container = dialog(`
      <button id="close">Close</button>
      <button id="decorative" aria-hidden="true">Decorative</button>
    `);
    expect(tabbableElements(container).map((e) => e.id)).toEqual(["close"]);
  });

  it("picks up controls that appear later, such as an error dismiss", () => {
    const container = dialog(`<button id="close">Close</button>`);
    expect(tabbableElements(container)).toHaveLength(1);

    const dismiss = document.createElement("button");
    dismiss.id = "dismiss";
    container.prepend(dismiss);

    // Queried fresh, so the banner joins the cycle without any re-registration.
    expect(tabbableElements(container).map((e) => e.id)).toEqual(["dismiss", "close"]);
  });
});

describe("isTabbable", () => {
  it("rejects a negative tabindex", () => {
    const el = document.createElement("h2");
    el.tabIndex = -1;
    expect(isTabbable(el)).toBe(false);
  });

  it("accepts an ordinary button", () => {
    expect(isTabbable(document.createElement("button"))).toBe(true);
  });
});

describe("nextFocusTarget", () => {
  const make = (n: number) =>
    Array.from({ length: n }, () => document.createElement("button"));

  it("wraps forward from the last control to the first", () => {
    const els = make(3);
    expect(nextFocusTarget(els, els[2]!, false)).toBe(els[0]);
  });

  it("wraps backward from the first control to the last", () => {
    const els = make(3);
    expect(nextFocusTarget(els, els[0]!, true)).toBe(els[2]);
  });

  it("leaves interior moves to the browser", () => {
    // Reimplementing the browser's own ordering would only create
    // disagreements with it.
    const els = make(3);
    expect(nextFocusTarget(els, els[1]!, false)).toBeNull();
    expect(nextFocusTarget(els, els[1]!, true)).toBeNull();
  });

  it("enters the sequence from the heading", () => {
    // Focus starts on the heading, which is outside the cycle.
    const els = make(3);
    const heading = document.createElement("h2");
    expect(nextFocusTarget(els, heading, false)).toBe(els[0]);
    expect(nextFocusTarget(els, heading, true)).toBe(els[2]);
  });

  it("handles a single control by keeping focus on it", () => {
    const els = make(1);
    expect(nextFocusTarget(els, els[0]!, false)).toBe(els[0]);
    expect(nextFocusTarget(els, els[0]!, true)).toBe(els[0]);
  });

  it("does nothing when there is nothing to focus", () => {
    expect(nextFocusTarget([], null, false)).toBeNull();
  });
});
