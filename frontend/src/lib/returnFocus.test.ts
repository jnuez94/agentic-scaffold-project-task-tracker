import { afterEach, describe, expect, it } from "vitest";
import { captureFocusReturn, restoreFocus } from "./returnFocus.ts";

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
    expect(captureFocusReturn(document)).toEqual({ origin: $("#act"), anchor: $("#title") });
  });

  it("walks out to an enclosing region when the nearest has no heading", () => {
    const $ = build(`<section><h2 id="sec">Stale sessions</h2><div role="region"><button id="act">Recover…</button></div></section>`);
    $("#act").focus();
    expect(captureFocusReturn(document).anchor).toBe($("#sec"));
  });

  it("records nothing when focus is on the body", () => {
    build(`<main><h1>Tasks</h1></main>`);
    expect(captureFocusReturn(document)).toEqual({ origin: null, anchor: null });
  });
});

describe("restoreFocus", () => {
  it("returns focus to the control that opened the dialog", () => {
    const $ = build(`<aside><h2 tabindex="-1">D-1</h2><button id="act">Change status…</button></aside>`);
    $("#act").focus();
    const target = captureFocusReturn(document);
    $("h2").focus();

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
