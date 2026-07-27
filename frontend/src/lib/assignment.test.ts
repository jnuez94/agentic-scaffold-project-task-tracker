import { describe, expect, it } from "vitest";
import type { Agent, TaskDetail } from "../api/contract.ts";
import {
  addCandidates,
  assignErrorCopy,
  buildAssignRequest,
  EMPTY_DRAFT,
  hasPendingChange,
  removalBlockedReason,
  resultingAssignees,
  wouldLeaveUnowned,
} from "./assignment.ts";

function task(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "SEC-1",
    title: "Repository-wide security review",
    status: "todo",
    assignees: ["toby", "codex-security"],
    claimed_by: null,
    claim_session_id: null,
    revision: 10,
    ...overrides,
  } as TaskDetail;
}

const AGENTS = [
  { id: "toby", name: "Toby", status: "active" },
  { id: "codex-security", name: "Toby", status: "inactive" },
  { id: "david", name: "David", status: "active" },
  { id: "mikhail-ux", name: "Mikhail", status: "inactive" },
] as Agent[];

describe("removalBlockedReason", () => {
  it("blocks removing the active claim owner, as a precondition not a failure", () => {
    const reason = removalBlockedReason(task({ claimed_by: "david" }), "david");
    expect(reason).toContain("david holds the active claim");
    expect(reason).toContain("Releasing or recovering the claim comes first");
  });

  it("allows removing an assignee who holds no claim", () => {
    expect(removalBlockedReason(task({ claimed_by: "david" }), "toby")).toBeNull();
  });

  it("allows removal when nobody holds a claim", () => {
    expect(removalBlockedReason(task(), "toby")).toBeNull();
  });
});

describe("addCandidates", () => {
  it("omits agents already assigned, which is what makes the overlap error unreachable", () => {
    const { selectable, retired } = addCandidates(AGENTS, task(), EMPTY_DRAFT);
    const offered = [...selectable, ...retired].map((a) => a.id);
    expect(offered).not.toContain("toby");
    expect(offered).not.toContain("codex-security");
  });

  it("separates retired agents so the panel can disable them", () => {
    // The CLI permits assigning a retired agent; the console declines to,
    // because that is how SEC-1 came to be owned by a deactivated identity.
    const { selectable, retired } = addCandidates(AGENTS, task(), EMPTY_DRAFT);
    expect(selectable.map((a) => a.id)).toEqual(["david"]);
    expect(retired.map((a) => a.id)).toEqual(["mikhail-ux"]);
  });

  it("omits agents already staged for addition", () => {
    const { selectable } = addCandidates(AGENTS, task(), { add: ["david"], remove: [] });
    expect(selectable.map((a) => a.id)).toEqual([]);
  });
});

describe("resultingAssignees", () => {
  it("states the outcome rather than making the operator reconstruct it", () => {
    const result = resultingAssignees(task(), { add: ["david"], remove: ["codex-security"] });
    expect(result).toEqual(["david", "toby"]);
  });

  it("is unchanged by an empty draft", () => {
    expect(resultingAssignees(task(), EMPTY_DRAFT)).toEqual(["codex-security", "toby"]);
  });

  it("does not duplicate an agent added twice", () => {
    expect(resultingAssignees(task(), { add: ["david", "david"], remove: [] })).toEqual([
      "codex-security",
      "david",
      "toby",
    ]);
  });
});

describe("wouldLeaveUnowned", () => {
  it("is true when the change removes the last assignee", () => {
    expect(wouldLeaveUnowned(task(), { add: [], remove: ["toby", "codex-security"] })).toBe(true);
  });

  it("is false when someone is added back in the same call", () => {
    expect(
      wouldLeaveUnowned(task(), { add: ["david"], remove: ["toby", "codex-security"] }),
    ).toBe(false);
  });

  it("is false for an empty draft on an already-unowned task", () => {
    // Nothing pending is not a warning about something about to happen.
    expect(wouldLeaveUnowned(task({ assignees: [] }), EMPTY_DRAFT)).toBe(false);
  });
});

describe("buildAssignRequest", () => {
  it("sends add and remove in one call with the current revision", () => {
    // Never two calls: a remove that succeeds and an add that fails would
    // leave a state the operator never asked for.
    const body = buildAssignRequest(task(), { add: ["david"], remove: ["codex-security"] }, "local-operator");
    expect(body).toEqual({
      actor: "local-operator",
      if_revision: 10,
      add: ["david"],
      remove: ["codex-security"],
    });
  });

  it("omits the empty side rather than sending an empty list", () => {
    const body = buildAssignRequest(task(), { add: [], remove: ["codex-security"] }, "local-operator");
    expect(body).not.toHaveProperty("add");
    expect(body["remove"]).toEqual(["codex-security"]);
  });
});

describe("hasPendingChange", () => {
  it("gates the submit control", () => {
    expect(hasPendingChange(EMPTY_DRAFT)).toBe(false);
    expect(hasPendingChange({ add: ["david"], remove: [] })).toBe(true);
    expect(hasPendingChange({ add: [], remove: ["toby"] })).toBe(true);
  });
});

describe("assignErrorCopy", () => {
  it("maps the claim-owner refusal, naming the agent", () => {
    expect(assignErrorCopy("task_claim_owner_mismatch", "raw", "david")).toContain(
      "david holds the active claim",
    );
  });

  it("maps a stale revision and promises the draft survives", () => {
    expect(assignErrorCopy("stale_task_revision", "raw")).toContain("draft will be preserved");
  });

  it("maps a missing agent", () => {
    expect(assignErrorCopy("not_found", "raw", "nobody")).toContain("no longer exists as an agent");
  });

  it("shows the CLI's own message for anything unmapped", () => {
    // Reachable only if the panel let through what it should have prevented,
    // so paraphrasing would hide the real cause.
    expect(assignErrorCopy("invalid_arguments", "cannot add and remove the same actor")).toBe(
      "cannot add and remove the same actor",
    );
  });

  it("branches on code, never on message text", () => {
    expect(assignErrorCopy("stale_task_revision", "completely unrelated wording")).toContain(
      "Reload latest",
    );
  });
});
