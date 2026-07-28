import { describe, expect, it } from "vitest";
import type { Agent, Session, TaskListRow } from "../api/contract.ts";
import {
  blockingSessions,
  outstandingAssignments,
  PROTECTED_AGENT_ID,
  retireErrorCopy,
  retirementBlock,
} from "./retirement.ts";

const NOW = Date.now();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

const AGENT = { id: "mikhail-ux", name: "Mikhail" } as Agent;

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "s-1",
    agent_id: "mikhail-ux",
    harness: "codex",
    model: "",
    status: "active",
    started_at: ago(7200),
    last_seen_at: ago(7200),
    ended_at: null,
    ...overrides,
  } as Session;
}

describe("blockingSessions", () => {
  it("finds only that agent's active sessions", () => {
    const rows = [
      session({ id: "mine" }),
      session({ id: "ended", status: "ended" }),
      session({ id: "theirs", agent_id: "david" }),
    ];
    expect(blockingSessions(rows, "mikhail-ux").map((s) => s.id)).toEqual(["mine"]);
  });

  it("returns nothing when the agent is idle", () => {
    expect(blockingSessions([session({ status: "ended" })], "mikhail-ux")).toEqual([]);
  });
});

describe("retirementBlock — the console's own guards", () => {
  it("refuses to retire the actor you are acting as", () => {
    // A retired agent cannot start a session, so this would be unrecoverable
    // from inside the console.
    const block = retirementBlock(AGENT, "mikhail-ux", []);
    expect(block?.kind).toBe("self");
    expect(block?.reason).toContain("Switch to another actor");
  });

  it("refuses to retire local-operator", () => {
    const block = retirementBlock({ id: PROTECTED_AGENT_ID, name: "Local Operator" } as Agent, "david", []);
    expect(block?.kind).toBe("protected");
    expect(block?.reason).toContain("recreate it");
  });

  it("reports its own guards before a session guard", () => {
    // Both apply: reporting sessions first would send the operator to end
    // sessions for a retirement that could never be safe anyway.
    const block = retirementBlock(AGENT, "mikhail-ux", [session()]);
    expect(block?.kind).toBe("self");
  });
});

describe("retirementBlock — the CLI's guard, surfaced early", () => {
  it("names the blocking sessions and their age", () => {
    const block = retirementBlock(AGENT, "david", [session({ id: "codex-99" })]);
    expect(block?.kind).toBe("active-sessions");
    expect(block?.reason).toContain("codex-99");
    expect(block?.reason).toContain("2 hours ago");
  });

  it("counts more than one correctly", () => {
    const block = retirementBlock(AGENT, "david", [
      session({ id: "a" }),
      session({ id: "b", last_seen_at: ago(60) }),
    ]);
    expect(block?.reason).toContain("2 active sessions");
  });

  it("allows retirement once nothing is active", () => {
    expect(retirementBlock(AGENT, "david", [session({ status: "ended" })])).toBeNull();
  });
});

describe("outstandingAssignments", () => {
  const task = (id: string, assignees: string[], status = "todo") =>
    ({ id, title: `Task ${id}`, assignees, status }) as TaskListRow;

  it("lists the work retirement would strand", () => {
    // The SEC-1 failure: retired, still assigned, nobody able to act.
    const rows = [
      task("UX-7", ["mikhail-ux"]),
      task("UX-1", ["mikhail-ux", "david"]),
      task("UI-1", ["david"]),
    ];
    expect(outstandingAssignments(rows, "mikhail-ux").map((t) => t.id)).toEqual(["UX-1", "UX-7"]);
  });

  it("ignores finished work, which strands nobody", () => {
    const rows = [task("DONE-1", ["mikhail-ux"], "done"), task("OPEN-1", ["mikhail-ux"])];
    expect(outstandingAssignments(rows, "mikhail-ux").map((t) => t.id)).toEqual(["OPEN-1"]);
  });

  it("returns nothing when the agent holds nothing", () => {
    expect(outstandingAssignments([task("UI-1", ["david"])], "mikhail-ux")).toEqual([]);
  });

  it("tolerates a row with no assignees field", () => {
    expect(outstandingAssignments([{ id: "X" } as TaskListRow], "mikhail-ux")).toEqual([]);
  });
});

describe("retireErrorCopy", () => {
  it("maps the active-session refusal and says how to clear it", () => {
    const copy = retireErrorCopy("agent_has_active_sessions", "raw", AGENT);
    expect(copy).toContain("Mikhail still has an active session");
    expect(copy).toContain("recover it from Health");
  });

  it("maps a missing agent", () => {
    expect(retireErrorCopy("not_found", "raw", AGENT)).toContain("no longer exists");
  });

  it("maps a retired acting actor", () => {
    expect(retireErrorCopy("inactive_actor", "raw", AGENT)).toContain("Choose an active actor");
  });

  it("falls back to the CLI's own message when unmapped", () => {
    expect(retireErrorCopy("internal_error", "something specific", AGENT)).toBe("something specific");
  });

  it("branches on code, not message text", () => {
    expect(retireErrorCopy("not_found", "totally unrelated wording", AGENT)).toContain(
      "Refresh the agent list",
    );
  });
});
