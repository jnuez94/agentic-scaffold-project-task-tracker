import { describe, expect, it } from "vitest";
import type { TaskListRow, TaskStatus } from "../api/contract.ts";
import { availableActions, isReleaseTarget, TRANSITIONS } from "./transitions.ts";

function task(overrides: Partial<TaskListRow> = {}): TaskListRow {
  return {
    id: "T-1",
    title: "Example",
    description: "",
    status: "todo",
    priority: 3,
    tags: "",
    acceptance_criteria: "",
    next_steps: "",
    blocked_claims: "",
    notes: "",
    revision: 1,
    created_by: "alice",
    created_at: "2026-07-25T00:00:00+00:00",
    updated_at: "2026-07-25T00:00:00+00:00",
    claimed_by: null,
    claim_session_id: null,
    claimed_at: null,
    assignees: [],
    evidence_count: 0,
    ...overrides,
  };
}

const owner = { actorId: "alice", sessionId: "s-1" };

describe("TRANSITIONS", () => {
  it("matches the contract's transition table", () => {
    expect(TRANSITIONS.todo).toEqual(["in_progress", "blocked"]);
    expect(TRANSITIONS.in_progress).toEqual(["todo", "review", "blocked"]);
    expect(TRANSITIONS.review).toEqual(["in_progress", "blocked", "done"]);
    expect(TRANSITIONS.blocked).toEqual(["todo", "in_progress"]);
    expect(TRANSITIONS.done).toEqual([]);
  });

  it("only ever targets valid statuses", () => {
    const valid: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"];
    for (const targets of Object.values(TRANSITIONS)) {
      for (const target of targets) expect(valid).toContain(target);
    }
  });
});

describe("availableActions", () => {
  it("offers claim rather than a status change for in_progress", () => {
    const actions = availableActions(task(), owner);
    const claim = actions.find((action) => action.target === "in_progress");
    expect(claim?.kind).toBe("claim");
    expect(claim?.label).toBe("Claim task");
  });

  it("offers nothing from done", () => {
    expect(availableActions(task({ status: "done" }), owner)).toEqual([]);
  });

  it("uses release semantics when leaving in_progress", () => {
    const actions = availableActions(
      task({ status: "in_progress", claimed_by: "alice", claim_session_id: "s-1" }),
      owner,
    );
    expect(actions.every((action) => action.kind === "release")).toBe(true);
  });

  it("blocks claiming without a session", () => {
    const [claim] = availableActions(task(), { actorId: "alice", sessionId: null });
    expect(claim?.blockedReason).toMatch(/active session/i);
  });

  it("blocks claiming without an actor", () => {
    const [claim] = availableActions(task(), { actorId: null, sessionId: "s-1" });
    expect(claim?.blockedReason).toMatch(/actor/i);
  });

  it("blocks claiming a task held by someone else", () => {
    const held = task({ claimed_by: "bob", claim_session_id: "s-2" });
    const [claim] = availableActions(held, owner);
    expect(claim?.blockedReason).toContain("bob");
  });

  it("blocks done until evidence exists", () => {
    const actions = availableActions(task({ status: "review", evidence_count: 0 }), owner);
    const done = actions.find((action) => action.target === "done");
    expect(done?.blockedReason).toMatch(/evidence required/i);
  });

  it("allows done once evidence exists", () => {
    const actions = availableActions(task({ status: "review", evidence_count: 2 }), owner);
    const done = actions.find((action) => action.target === "done");
    expect(done?.blockedReason).toBeUndefined();
  });

  it("blocks leaving in_progress from a different session", () => {
    const held = task({ status: "in_progress", claimed_by: "alice", claim_session_id: "s-9" });
    const [action] = availableActions(held, owner);
    expect(action?.blockedReason).toContain("s-9");
  });

  it("blocks leaving in_progress when another actor owns the claim", () => {
    const held = task({ status: "in_progress", claimed_by: "bob", claim_session_id: "s-1" });
    const [action] = availableActions(held, owner);
    expect(action?.blockedReason).toContain("bob");
  });

  it("marks review and done as primary actions", () => {
    const actions = availableActions(
      task({ status: "review", evidence_count: 1 }),
      owner,
    );
    expect(actions.find((a) => a.target === "done")?.primary).toBe(true);
    expect(actions.find((a) => a.target === "blocked")?.primary).toBe(false);
  });
});

describe("isReleaseTarget", () => {
  it("accepts only the documented release targets", () => {
    expect(isReleaseTarget("todo")).toBe(true);
    expect(isReleaseTarget("review")).toBe(true);
    expect(isReleaseTarget("blocked")).toBe(true);
    expect(isReleaseTarget("done")).toBe(false);
    expect(isReleaseTarget("in_progress")).toBe(false);
  });
});
