import { describe, expect, it } from "vitest";
import type { Session, TaskListRow } from "../api/contract.ts";
import {
  describeAge,
  isRecoverable,
  recoveryCaution,
  secondsSinceSeen,
  STALE_AFTER_SECONDS,
  tasksClaimedBy,
} from "./staleness.ts";

const NOW = new Date("2026-07-26T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "console-1",
    agent_id: "local-operator",
    harness: "coordination-console",
    model: "",
    status: "active",
    started_at: ago(7200),
    last_seen_at: ago(7200),
    ended_at: null,
    ...overrides,
  };
}

describe("secondsSinceSeen", () => {
  it("measures the gap", () => {
    expect(secondsSinceSeen(ago(3600), NOW)).toBe(3600);
  });

  it("never reports negative time for a clock skewed into the future", () => {
    expect(secondsSinceSeen(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe(0);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(secondsSinceSeen("not a date", NOW)).toBeNull();
  });
});

describe("isRecoverable", () => {
  it("matches the contract threshold", () => {
    expect(isRecoverable(session({ last_seen_at: ago(STALE_AFTER_SECONDS) }), NOW)).toBe(true);
  });

  it("refuses a session seen more recently than the threshold", () => {
    // Offering it would earn a session_not_stale from the CLI, so the console
    // must not present the action at all.
    expect(isRecoverable(session({ last_seen_at: ago(STALE_AFTER_SECONDS - 1) }), NOW)).toBe(false);
  });

  it("refuses an already-ended session", () => {
    expect(isRecoverable(session({ status: "ended", last_seen_at: ago(99999) }), NOW)).toBe(false);
  });

  it("refuses an unreadable last_seen_at rather than assuming it is old", () => {
    expect(isRecoverable(session({ last_seen_at: "" }), NOW)).toBe(false);
  });
});

describe("describeAge", () => {
  it("scales the unit to the gap", () => {
    expect(describeAge(30)).toBe("less than a minute ago");
    expect(describeAge(60)).toBe("1 minute ago");
    expect(describeAge(3600)).toBe("1 hour ago");
    expect(describeAge(7200)).toBe("2 hours ago");
    expect(describeAge(86400 * 3)).toBe("3 days ago");
  });

  it("says so when it does not know", () => {
    expect(describeAge(null)).toBe("at an unknown time");
  });
});

describe("recoveryCaution", () => {
  it("states the age and that the age proves nothing", () => {
    const caution = recoveryCaution(ago(7200), NOW);
    expect(caution).toContain("2 hours ago");
    expect(caution).toContain("does not mean it was abandoned");
    expect(caution).toContain("still in use");
  });

  it("warns identically for a barely-stale and a long-dead session", () => {
    // The console cannot tell these apart, and a caution that fades as the gap
    // grows would be absent exactly when the guess turns out wrong.
    const barely = recoveryCaution(ago(STALE_AFTER_SECONDS), NOW);
    const ancient = recoveryCaution(ago(86400 * 30), NOW);
    const strip = (text: string) => text.replace(/last seen .*? ago/, "");
    expect(strip(barely)).toBe(strip(ancient));
  });
});

describe("tasksClaimedBy", () => {
  const task = (id: string, sessionId: string | null): TaskListRow =>
    ({ id, title: `Task ${id}`, claim_session_id: sessionId }) as TaskListRow;

  it("finds only the tasks the session holds", () => {
    const rows = [task("T-2", "s1"), task("T-9", "other"), task("T-1", "s1"), task("T-3", null)];
    expect(tasksClaimedBy(rows, "s1").map((t) => t.id)).toEqual(["T-1", "T-2"]);
  });

  it("returns nothing when the session holds nothing", () => {
    expect(tasksClaimedBy([task("T-1", null)], "s1")).toEqual([]);
  });

  it("does not mutate the input order", () => {
    const rows = [task("T-2", "s1"), task("T-1", "s1")];
    tasksClaimedBy(rows, "s1");
    expect(rows.map((t) => t.id)).toEqual(["T-2", "T-1"]);
  });
});
