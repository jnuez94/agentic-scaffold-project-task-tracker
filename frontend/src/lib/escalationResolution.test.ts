import { describe, expect, it } from "vitest";
import {
  buildResolutionRequest,
  emptyResolution,
  isResolvable,
  ownerNote,
  resolutionAnnouncement,
  resolutionBlockedReason,
  type TaskIdState,
} from "./escalationResolution.ts";

describe("isResolvable", () => {
  it("offers an answer only while the escalation waits for one", () => {
    expect(isResolvable({ status: "open" })).toBe(true);
    expect(isResolvable({ status: "in_review" })).toBe(true);
    expect(isResolvable({ status: "resolved" })).toBe(false);
    expect(isResolvable({ status: "closed_no_action" })).toBe(false);
  });
});

describe("resolutionBlockedReason", () => {
  const draft = { ...emptyResolution(), resolution: "Ship it." };
  const states = (map: Record<string, TaskIdState>) => (id: string): TaskIdState => map[id] ?? "missing";

  it("needs a resolution", () => {
    expect(resolutionBlockedReason({ ...draft, resolution: "  " }, states({}))).toMatch(/Write the resolution/);
  });

  it("refuses follow-ups that are not tasks, naming them", () => {
    expect(resolutionBlockedReason({ ...draft, followUps: "UI-1, UI-2" }, states({ "UI-1": "known", "UI-2": "known" }))).toBeNull();
    expect(resolutionBlockedReason({ ...draft, followUps: "UI-1 UI-9" }, states({ "UI-1": "known" }))).toBe("UI-9 is not a task on this board.");
    expect(resolutionBlockedReason({ ...draft, followUps: "X-1, X-2" }, states({}))).toBe("X-1, X-2 are not tasks on this board.");
  });

  it("waits while an id outside the loaded list is looked up, and says when a lookup failed", () => {
    expect(resolutionBlockedReason({ ...draft, followUps: "UI-700" }, states({ "UI-700": "checking" }))).toBe("Checking UI-700…");
    expect(resolutionBlockedReason({ ...draft, followUps: "UI-700" }, states({ "UI-700": "failed" }))).toMatch(/Could not check UI-700/);
  });
});

describe("ownerNote", () => {
  it("says so, without blocking, when the actor is not the owner", () => {
    expect(ownerNote({ owner: "michael-ux" }, "local-operator")).toBe(
      "You are not this escalation's owner (michael-ux). The record will name you as the resolver.",
    );
    expect(ownerNote({ owner: "local-operator" }, "local-operator")).toBeNull();
    expect(ownerNote({ owner: "the product council" }, null)).toBeNull();
  });
});

describe("buildResolutionRequest", () => {
  it("sends the loaded status as if_status and only what was given", () => {
    expect(
      buildResolutionRequest({ status: "open" }, { ...emptyResolution(), resolution: "  Done. " }, "local-operator"),
    ).toEqual({ actor: "local-operator", status: "resolved", resolution: "Done.", if_status: "open" });
  });

  it("carries the outcome, follow-ups and cause when present", () => {
    expect(
      buildResolutionRequest(
        { status: "in_review" },
        { outcome: "closed_no_action", resolution: "Moot.", followUps: "UI-1 UI-2", because: "decision:DEC-1" },
        "david",
      ),
    ).toEqual({
      actor: "david",
      status: "closed_no_action",
      resolution: "Moot.",
      if_status: "in_review",
      follow_up_tasks: "UI-1, UI-2",
      because: "decision:DEC-1",
    });
  });
});

describe("resolutionAnnouncement", () => {
  it("names the outcome and the receipt", () => {
    expect(resolutionAnnouncement("ESC-1", "resolved", { audit_range: [12, 12] })).toBe(
      "ESC-1 resolved. Recorded as audit 12.",
    );
    expect(resolutionAnnouncement("ESC-1", "closed_no_action", {})).toBe("ESC-1 closed with no action.");
  });
});
