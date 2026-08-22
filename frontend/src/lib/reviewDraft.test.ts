import { describe, expect, it } from "vitest";
import {
  buildReviewRequest,
  checkReviewDraft,
  DECISION_CONSEQUENCE,
  DECISION_LABELS,
  emptyReview,
  isDuplicateReviewId,
  latestEvidenceUri,
  REVIEW_DECISIONS,
  suggestReviewId,
  type ReviewDraft,
} from "./reviewDraft.ts";

const IDS = ["UX-UI46-QA-1", "FE-ARCH-REVIEW-1", "REVIEW-UI42-1"];

const draft = (over: Partial<ReviewDraft> = {}): ReviewDraft => ({
  id: "REVIEW-UI42-2",
  decision: "accepted",
  artifact: "commit:82f16a0",
  scope: "attention strip",
  acceptedItems: "",
  requiredChanges: "none",
  risks: "",
  blockedClaims: "does not authorize release",
  followUpTasks: "",
  ...over,
});

describe("suggestReviewId", () => {
  it("continues the task's own review prefix", () => {
    expect(suggestReviewId("UI-42", IDS)).toBe("REVIEW-UI42-2");
  });
  it("starts at 1 for a task with no reviews", () => {
    expect(suggestReviewId("UI-57", IDS)).toBe("REVIEW-UI57-1");
  });
});

describe("latestEvidenceUri", () => {
  it("takes the most recent evidence, and nothing when there is none", () => {
    expect(latestEvidenceUri({ evidence: [{ uri: "a" }, { uri: "b" }] as never })).toBe("b");
    expect(latestEvidenceUri({ evidence: [] })).toBe("");
  });
});

describe("emptyReview", () => {
  it("pre-fills id and artifact from the task, and defaults to accepted", () => {
    const d = emptyReview({ id: "UI-42", evidence: [{ uri: "commit:1" }] as never }, IDS);
    expect(d.id).toBe("REVIEW-UI42-2");
    expect(d.artifact).toBe("commit:1");
    expect(d.decision).toBe("accepted");
  });
});

describe("checkReviewDraft", () => {
  const ctx = { actorId: "david", existingIds: IDS };

  it("requires an actor first", () => {
    expect(checkReviewDraft(draft(), { ...ctx, actorId: null })?.field).toBe("actor");
  });

  it("requires id, artifact and scope — the CLI's own requirements", () => {
    expect(checkReviewDraft(draft({ id: "" }), ctx)?.field).toBe("id");
    expect(checkReviewDraft(draft({ id: "REVIEW-UI42-1" }), ctx)?.message).toContain("already exists");
    expect(checkReviewDraft(draft({ artifact: " " }), ctx)?.field).toBe("artifact");
    expect(checkReviewDraft(draft({ scope: "" }), ctx)?.field).toBe("scope");
  });

  it("makes required_changes and blocked_claims mandatory, per the ruling", () => {
    expect(checkReviewDraft(draft({ requiredChanges: "" }), ctx)?.field).toBe("requiredChanges");
    expect(checkReviewDraft(draft({ blockedClaims: " " }), ctx)?.field).toBe("blockedClaims");
  });

  it("holds an acceptance to the same bar as a rejection", () => {
    // An acceptance that cannot say what it does not authorize is not one.
    expect(checkReviewDraft(draft({ decision: "accepted", blockedClaims: "" }), ctx)?.field).toBe(
      "blockedClaims",
    );
  });

  it("passes a complete draft", () => {
    expect(checkReviewDraft(draft(), ctx)).toBeNull();
  });
});

describe("buildReviewRequest", () => {
  it("sends the CLI's required fields plus the two mandatory ones", () => {
    expect(buildReviewRequest(draft(), "UI-42", "david")).toEqual({
      id: "REVIEW-UI42-2",
      task: "UI-42",
      reviewer: "david",
      artifact: "commit:82f16a0",
      scope: "attention strip",
      decision: "accepted",
      required_changes: "none",
      blocked_claims: "does not authorize release",
    });
  });

  it("omits empty optionals and maps the rest to the route's names", () => {
    const body = buildReviewRequest(
      draft({ acceptedItems: "a", risks: " ", followUpTasks: "UI-60" }),
      "UI-42",
      "david",
    );
    expect(body["accepted_items"]).toBe("a");
    expect("risks" in body).toBe(false);
    expect(body["follow_up_tasks"]).toBe("UI-60");
  });
});

describe("decision vocabulary", () => {
  it("covers every decision the CLI accepts, with a label and a consequence", () => {
    expect(REVIEW_DECISIONS).toEqual([
      "accepted",
      "conditionally_accepted",
      "changes_requested",
      "rejected",
    ]);
    for (const d of REVIEW_DECISIONS) {
      expect(DECISION_LABELS[d]).toBeTruthy();
      expect(DECISION_CONSEQUENCE[d]).toMatch(/review/);
    }
  });
});

describe("isDuplicateReviewId", () => {
  it("matches only the reviews.id constraint", () => {
    expect(isDuplicateReviewId("constraint_violation", { database_error: "UNIQUE constraint failed: reviews.id" })).toBe(true);
    expect(isDuplicateReviewId("constraint_violation", { database_error: "UNIQUE constraint failed: tasks.id" })).toBe(false);
  });
});
