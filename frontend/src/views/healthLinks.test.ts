import { describe, expect, it } from "vitest";
import { findingHref } from "./HealthView.tsx";

describe("findingHref", () => {
  // The defect: Health named UX-1, UX-12, UX-7 and offered no way to reach any
  // of them, even though #/tasks/UX-1 already resolves and opens the inspector.
  it("deep-links a task finding into the inspector", () => {
    expect(findingHref("task", "UX-1")).toBe("#/tasks/UX-1");
  });

  it("sends a session finding to the sessions route", () => {
    expect(findingHref("session", "david-fe-20260725")).toBe("#/sessions");
  });

  it("leaves a finding with nowhere useful to go unlinked", () => {
    // Escalations are listed but have no per-record view; a link that lands
    // nowhere useful is worse than plain text.
    expect(findingHref(null, "ESC-1")).toBeNull();
  });

  it("does not link a synthesised placeholder id", () => {
    // identify() falls back to `row-N` when a row carries no id at all.
    expect(findingHref("task", "row-3")).toBeNull();
  });

  it("does not link an empty id", () => {
    expect(findingHref("task", "")).toBeNull();
  });

  it("encodes an id that would otherwise break the hash", () => {
    expect(findingHref("task", "UI 1/2")).toBe("#/tasks/UI%201%2F2");
  });
});
