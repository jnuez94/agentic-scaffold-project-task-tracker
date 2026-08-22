import { describe, expect, it } from "vitest";
import {
  buildCreateRequest,
  checkTaskDraft,
  duplicateIdCopy,
  EMPTY_DRAFT,
  isDuplicateId,
  isValidTaskId,
  nextFreeId,
  prefixesInUse,
  prefixOf,
  type TaskDraft,
} from "./taskDraft.ts";

const IDS = ["UI-1", "UI-2", "UI-60", "UX-24", "BRAND-7", "SEC-1", "odd_id"];

const draft = (over: Partial<TaskDraft> = {}): TaskDraft => ({
  id: "UI-61",
  ...EMPTY_DRAFT,
  title: "A task",
  ...over,
});

describe("prefixesInUse", () => {
  it("orders most-used first so the default is what the board files under", () => {
    expect(prefixesInUse(IDS).map((p) => p.prefix)).toEqual(["UI", "BRAND", "SEC", "UX"]);
  });

  it("tracks the highest number per prefix, not the count", () => {
    expect(prefixesInUse(IDS).find((p) => p.prefix === "UI")).toEqual({
      prefix: "UI",
      count: 3,
      highest: 60,
    });
  });

  it("ignores ids that are not PREFIX-N", () => {
    expect(prefixesInUse(["odd_id", "x"]).length).toBe(0);
  });
});

describe("nextFreeId", () => {
  it("is one past the highest seen", () => {
    expect(nextFreeId("UI", IDS)).toBe("UI-61");
  });

  it("starts a new prefix at 1", () => {
    expect(nextFreeId("DOC", IDS)).toBe("DOC-1");
  });

  it("does not fill gaps, which would reuse an id someone may remember", () => {
    expect(nextFreeId("UI", ["UI-1", "UI-5"])).toBe("UI-6");
  });
});

describe("isValidTaskId", () => {
  it("accepts the schema's permitted shapes", () => {
    for (const id of ["UI-61", "a", "9x", "A.b_c:d@e+f-g"]) expect(isValidTaskId(id)).toBe(true);
  });

  it("rejects what the schema rejects", () => {
    for (const id of ["", "-x", "_x", "UI 61", "UI/61", "x".repeat(129)]) {
      expect(isValidTaskId(id)).toBe(false);
    }
  });
});

describe("checkTaskDraft", () => {
  const ctx = { actorId: "david", existingIds: IDS };

  it("requires an actor before anything else", () => {
    expect(checkTaskDraft(draft(), { ...ctx, actorId: null })?.field).toBe("actor");
  });

  it("requires an id, then a valid one", () => {
    expect(checkTaskDraft(draft({ id: "" }), ctx)?.message).toBe("Give the task an id.");
    expect(checkTaskDraft(draft({ id: "bad id" }), ctx)?.field).toBe("id");
  });

  it("refuses a duplicate and offers the next free number", () => {
    const problem = checkTaskDraft(draft({ id: "UI-60" }), ctx);
    expect(problem?.field).toBe("id");
    expect(problem?.message).toBe("UI-60 already exists. Next free is UI-61.");
  });

  it("requires a title", () => {
    expect(checkTaskDraft(draft({ title: "  " }), ctx)?.field).toBe("title");
  });

  it("passes a complete draft", () => {
    expect(checkTaskDraft(draft(), ctx)).toBeNull();
  });
});

describe("duplicateIdCopy", () => {
  it("names the clash and the way out", () => {
    expect(duplicateIdCopy("UX-24", IDS)).toBe("UX-24 already exists. Next free is UX-25.");
  });

  it("cannot suggest for a non-prefixed id, and says only what it knows", () => {
    expect(duplicateIdCopy("odd_id", IDS)).toBe("odd_id already exists.");
  });
});

describe("isDuplicateId", () => {
  it("recognises the CLI's unique-constraint refusal on tasks.id", () => {
    expect(
      isDuplicateId("constraint_violation", { database_error: "UNIQUE constraint failed: tasks.id" }),
    ).toBe(true);
  });

  it("does not mistake other constraint failures for a duplicate id", () => {
    expect(
      isDuplicateId("constraint_violation", { database_error: "FOREIGN KEY constraint failed" }),
    ).toBe(false);
    expect(isDuplicateId("invalid_arguments", {})).toBe(false);
  });
});

describe("buildCreateRequest", () => {
  it("sends the required fields and the actor", () => {
    expect(buildCreateRequest(draft(), "david")).toEqual({
      id: "UI-61",
      title: "A task",
      actor: "david",
      priority: 3,
    });
  });

  it("omits empty optionals rather than sending blanks", () => {
    const body = buildCreateRequest(draft({ description: "  ", tags: "" }), "david");
    expect("description" in body).toBe(false);
    expect("tags" in body).toBe(false);
  });

  it("sends an assignee as the list the route expects", () => {
    expect(buildCreateRequest(draft({ assignee: "toby" }), "david")["assignees"]).toEqual(["toby"]);
  });

  it("maps nextSteps and blockedClaims to the route's snake_case", () => {
    const body = buildCreateRequest(
      draft({ nextSteps: "do x", blockedClaims: "no release" }),
      "david",
    );
    expect(body["next_steps"]).toBe("do x");
    expect(body["blocked_claims"]).toBe("no release");
  });

  it("trims the id and title", () => {
    const body = buildCreateRequest(draft({ id: " UI-61 ", title: " t " }), "david");
    expect(body["id"]).toBe("UI-61");
    expect(body["title"]).toBe("t");
  });
});

describe("prefixOf", () => {
  it("reads the prefix from PREFIX-N and nothing else", () => {
    expect(prefixOf("UI-61")).toBe("UI");
    expect(prefixOf("odd_id")).toBeNull();
  });
});
