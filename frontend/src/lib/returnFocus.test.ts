import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFocusReturn, focusIsLost, followOpenerRemoval, pressedControl, restoreFocus } from "./returnFocus.ts";

function build(html: string) {
  document.body.innerHTML = html;
  return (selector: string) => document.querySelector<HTMLElement>(selector)!;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("captureFocusReturn", () => {
  it("records the focused control and the heading of its region", () => {
    const $ = build(`<main><h1>Decisions</h1><aside><h2 id="title" tabindex="-1">D-1</h2><button id="act">Change status…</button></aside></main>`);
    $("#act").focus();
    expect(captureFocusReturn(document)).toEqual({ origin: $("#act"), originId: "act", anchor: $("#title") });
  });

  it("walks out to an enclosing region when the nearest has no heading", () => {
    const $ = build(`<section><h2 id="sec">Stale sessions</h2><div role="region"><button id="act">Recover…</button></div></section>`);
    $("#act").focus();
    expect(captureFocusReturn(document).anchor).toBe($("#sec"));
  });

  it("records nothing when focus is on the body", () => {
    build(`<main><h1>Tasks</h1></main>`);
    expect(captureFocusReturn(document)).toEqual({ origin: null, originId: null, anchor: null });
  });
});

describe("restoreFocus", () => {
  it("returns focus to the control that opened the dialog", () => {
    const $ = build(
      `<aside><h2 tabindex="-1">D-1</h2><button id="act">Change status…</button></aside><div id="dialog" tabindex="-1"></div>`,
    );
    $("#act").focus();
    const target = captureFocusReturn(document);
    $("#dialog").focus();
    $("#dialog").remove();

    expect(restoreFocus(target, document)).toBe($("#act"));
    expect(document.activeElement).toBe($("#act"));
  });

  it("falls back to the region's heading when the control has gone", () => {
    const $ = build(`<section><h2 id="sec">Stale sessions</h2><ul><li><button id="act">Recover…</button></li></ul></section>`);
    $("#act").focus();
    const target = captureFocusReturn(document);
    $("li").remove();

    expect(restoreFocus(target, document)).toBe($("#sec"));
    expect($("#sec").getAttribute("tabindex")).toBe("-1");
  });

  it("falls back when the control is still there but cannot take focus", () => {
    const $ = build(
      `<aside><h2 id="title" tabindex="-1">A-1</h2><button id="act">Retire agent…</button></aside><div id="dialog" tabindex="-1"></div>`,
    );
    $("#act").focus();
    const target = captureFocusReturn(document);
    $("#dialog").focus();
    ($("#act") as HTMLButtonElement).disabled = true;
    $("#dialog").remove();

    expect(restoreFocus(target, document)).toBe($("#title"));
  });

  it("ends on the page heading rather than the body when both are gone", () => {
    const $ = build(`<main><h1 id="page">Health</h1><section id="s"><h2>Stale</h2><button id="act">Recover…</button></section></main>`);
    $("#act").focus();
    const target = captureFocusReturn(document);
    $("#s").remove();

    expect(restoreFocus(target, document)).toBe($("#page"));
  });
});

describe("restoreFocus when the opener was replaced or focus was not lost", () => {
  it("finds the opener's successor by id once the original has gone", () => {
    const $ = build(`<section><h2>Evidence</h2><div id="slot"><button id="add-evidence-trigger">Add evidence</button></div></section>`);
    $("#add-evidence-trigger").focus();
    const target = captureFocusReturn(document);
    $("#slot").innerHTML = `<button id="add-evidence-trigger">Add evidence</button>`;

    expect(restoreFocus(target, document)).toBe($("#add-evidence-trigger"));
    expect($("#add-evidence-trigger")).not.toBe(target.origin);
  });

  it("leaves focus alone when the operator already put it on a live control", () => {
    const $ = build(`<main><h1>Tasks</h1><button id="row">T-1</button><button id="file">File a task</button></main>`);
    $("#row").focus();
    const target = captureFocusReturn(document);
    $("#file").focus();

    expect(focusIsLost(document)).toBe(false);
    expect(restoreFocus(target, document)).toBeNull();
    expect(document.activeElement).toBe($("#file"));
  });

  it("takes a recent press as the opener when the click did not focus it", () => {
    const $ = build(`<aside><h2 id="title">D-1</h2><button id="act">Change status…</button></aside>`);
    const target = captureFocusReturn(document, pressedControl($("#act")));
    expect(target.origin).toBe($("#act"));
    expect(target.anchor).toBe($("#title"));
  });

  it("finds the control a press landed inside", () => {
    const $ = build(`<button id="act"><span id="label">Retire agent…</span></button><p id="text">plain</p>`);
    expect(pressedControl($("#label"))).toBe($("#act"));
    expect(pressedControl($("#text"))).toBeNull();
  });
});

describe("followOpenerRemoval", () => {
  it("moves focus on to the heading when the opener leaves after focus returned to it", async () => {
    const $ = build(`<aside><h2 id="title" tabindex="-1">ESC-1</h2><div id="actions"><button id="act">Resolve…</button></div></aside>`);
    $("#act").focus();
    const target = captureFocusReturn(document);
    followOpenerRemoval(target, document);

    $("#actions").replaceChildren();
    await Promise.resolve();

    expect(document.activeElement).toBe($("#title"));
  });

  it("leaves focus alone if the operator moved it before the opener left", async () => {
    const $ = build(`<aside><h2 tabindex="-1">ESC-1</h2><div id="actions"><button id="act">Resolve…</button></div><input id="elsewhere" /></aside>`);
    $("#act").focus();
    const target = captureFocusReturn(document);
    followOpenerRemoval(target, document);
    $("#elsewhere").focus();

    $("#actions").replaceChildren();
    await Promise.resolve();

    expect(document.activeElement).toBe($("#elsewhere"));
  });

  it("stops watching after its window", async () => {
    vi.useFakeTimers();
    try {
      const $ = build(`<aside><h2 id="title" tabindex="-1">ESC-1</h2><div id="actions"><button id="act">Resolve…</button></div></aside>`);
      $("#act").focus();
      followOpenerRemoval(captureFocusReturn(document), document, 100);
      vi.advanceTimersByTime(150);
      $("#actions").replaceChildren();
      await Promise.resolve();
      expect(document.activeElement).not.toBe($("#title"));
    } finally {
      vi.useRealTimers();
    }
  });
});
