import { describe, expect, it } from "vitest";
import {
  blockingReason,
  buildEscalationRequest,
  checkEscalationDraft,
  emptyEscalation,
  escalationPrefixes,
  isDuplicateEscalationId,
  suggestEscalationId,
  type EscalationDraft,
} from "./escalationDraft.ts";
import { stashEscalationIntent, takeEscalationIntent } from "./escalationIntent.ts";

const IDS = ["UX-REVIEW-BLOCK-1", "UX-QA-BLOCK-1", "ESC-SEC1-OWNER-1", "ESC-REL1-OPERATOR-1"];

const draft = (over: Partial<EscalationDraft> = {}): EscalationDraft => ({
  id: "ESC-UI12-1",
  owner: "michael-ux",
  relatedTasks: "UI-12",
  neededBy: "",
  issue: "stuck",
  requestedDecision: "unblock",
  ...over,
});

describe("blockingReason", () => {
  it("prefers the authority boundary, then the notes, as the inspector does", () => {
    expect(blockingReason({ blocked_claims: " why ", notes: "n" })).toBe("why");
    expect(blockingReason({ blocked_claims: "", notes: " n " })).toBe("n");
    expect(blockingReason({ blocked_claims: "", notes: "" })).toBe("");
  });
});

describe("escalationPrefixes", () => {
  it("treats everything before the final dash as the prefix", () => {
    expect(escalationPrefixes(IDS).map((p) => p.prefix)).toEqual([
      "ESC-REL1-OPERATOR",
      "ESC-SEC1-OWNER",
      "UX-QA-BLOCK",
      "UX-REVIEW-BLOCK",
    ]);
  });
});

describe("suggestEscalationId", () => {
  it("follows the board's ESC-<TASK>-N convention for a task", () => {
    expect(suggestEscalationId("UI-12", IDS)).toBe("ESC-UI12-1");
  });

  it("continues a prefix that already exists", () => {
    expect(suggestEscalationId("SEC-1", ["ESC-SEC1-1", "ESC-SEC1-2"])).toBe("ESC-SEC1-3");
  });

  it("falls back to ESC-N with no task", () => {
    expect(suggestEscalationId(null, IDS)).toBe("ESC-1");
  });
});

describe("emptyEscalation", () => {
  it("pre-fills the task and the issue from the handoff", () => {
    const d = emptyEscalation("UI-12", "why", IDS);
    expect(d.relatedTasks).toBe("UI-12");
    expect(d.issue).toBe("why");
    expect(d.id).toBe("ESC-UI12-1");
  });
});

describe("checkEscalationDraft", () => {
  const ctx = { actorId: "david", existingIds: IDS };

  it("requires an actor first", () => {
    expect(checkEscalationDraft(draft(), { ...ctx, actorId: null })?.field).toBe("actor");
  });

  it("checks id, owner, issue, decision in that order", () => {
    expect(checkEscalationDraft(draft({ id: "" }), ctx)?.field).toBe("id");
    expect(checkEscalationDraft(draft({ id: "ESC-SEC1-OWNER-1" }), ctx)?.message).toContain("already exists");
    expect(checkEscalationDraft(draft({ owner: "" }), ctx)?.field).toBe("owner");
    expect(checkEscalationDraft(draft({ issue: " " }), ctx)?.field).toBe("issue");
    expect(checkEscalationDraft(draft({ requestedDecision: "" }), ctx)?.field).toBe("requestedDecision");
  });

  it("passes a complete draft", () => {
    expect(checkEscalationDraft(draft(), ctx)).toBeNull();
  });
});

describe("buildEscalationRequest", () => {
  it("sends the route's required fields with raised_by as the actor", () => {
    expect(buildEscalationRequest(draft(), "david")).toEqual({
      id: "ESC-UI12-1",
      raised_by: "david",
      owner: "michael-ux",
      issue: "stuck",
      requested_decision: "unblock",
      related_tasks: "UI-12",
    });
  });

  it("omits empty optionals", () => {
    const body = buildEscalationRequest(draft({ relatedTasks: "", neededBy: " " }), "david");
    expect("related_tasks" in body).toBe(false);
    expect("needed_by" in body).toBe(false);
  });
});

describe("isDuplicateEscalationId", () => {
  it("recognises the unique-constraint refusal on escalations.id only", () => {
    expect(
      isDuplicateEscalationId("constraint_violation", {
        database_error: "UNIQUE constraint failed: escalations.id",
      }),
    ).toBe(true);
    expect(
      isDuplicateEscalationId("constraint_violation", { database_error: "UNIQUE constraint failed: tasks.id" }),
    ).toBe(false);
  });
});

describe("escalation intent", () => {
  it("is consumed exactly once, and only by the task it names", () => {
    stashEscalationIntent({ taskId: "UI-12", issue: "why" });
    expect(takeEscalationIntent("UI-99")).toBeNull();
    expect(takeEscalationIntent("UI-12")).toEqual({ taskId: "UI-12", issue: "why" });
    expect(takeEscalationIntent("UI-12")).toBeNull();
  });

  it("survives garbage in storage rather than throwing", () => {
    sessionStorage.setItem("coordination-console.escalationIntent", "{not json");
    expect(takeEscalationIntent("UI-12")).toBeNull();
  });
});
