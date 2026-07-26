import { describe, expect, it } from "vitest";
import type { Session } from "../api/contract.ts";
import {
  isStaleSelection,
  resolveSession,
  selectableSessions,
  sessionReason,
} from "./sessionIdentity.ts";

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "console-1",
    agent_id: "local-operator",
    harness: "coordination-console",
    model: "",
    status: "active",
    started_at: "2026-07-26T10:00:00+00:00",
    last_seen_at: "2026-07-26T10:00:00+00:00",
    ended_at: null,
    ...overrides,
  };
}

describe("resolveSession", () => {
  it("keeps a session that exists, is active, and belongs to the actor", () => {
    const active = session();
    expect(resolveSession("console-1", "local-operator", [active])).toEqual({
      sessionId: "console-1",
      rejection: null,
    });
  });

  it("reports none-selected when nothing is persisted", () => {
    expect(resolveSession(null, "local-operator", [session()])).toEqual({
      sessionId: null,
      rejection: "none-selected",
    });
  });

  it("clears a session that no longer exists", () => {
    expect(resolveSession("console-gone", "local-operator", [session()])).toEqual({
      sessionId: null,
      rejection: "missing",
    });
  });

  it("clears an ended session rather than presenting it as active", () => {
    // The exact pass-2 finding: an ended session was still shown as current.
    const ended = session({ id: "mikhail-ux-codex-20260725-05", status: "ended" });
    expect(resolveSession(ended.id, "mikhail-ux", [ended])).toEqual({
      sessionId: null,
      rejection: "ended",
    });
  });

  it("clears a session owned by another actor", () => {
    const other = session({ id: "console-2", agent_id: "david" });
    expect(resolveSession("console-2", "local-operator", [other])).toEqual({
      sessionId: null,
      rejection: "wrong-actor",
    });
  });

  it("accepts a session when no actor is selected yet", () => {
    // Actor ownership cannot be judged without an actor; existence and
    // activeness still are.
    expect(resolveSession("console-1", null, [session()]).sessionId).toBe("console-1");
  });

  it("restores a previously valid session when it is active again in the list", () => {
    const before = resolveSession("console-1", "local-operator", []);
    expect(before.rejection).toBe("missing");
    const after = resolveSession("console-1", "local-operator", [session()]);
    expect(after.sessionId).toBe("console-1");
  });

  it("drops the selection when the actor switches away", () => {
    const owned = session({ id: "console-1", agent_id: "local-operator" });
    expect(resolveSession("console-1", "local-operator", [owned]).sessionId).toBe("console-1");
    expect(resolveSession("console-1", "david", [owned]).rejection).toBe("wrong-actor");
  });
});

describe("sessionReason", () => {
  it("returns null when a session resolved", () => {
    expect(sessionReason(null, "local-operator")).toBeNull();
  });

  it("gives one sentence per rejection", () => {
    for (const rejection of ["none-selected", "missing", "ended", "wrong-actor"] as const) {
      const reason = sessionReason(rejection, "local-operator");
      expect(reason).toBeTruthy();
      expect(reason).toContain("local-operator");
    }
  });

  it("distinguishes an ended session from one that was never selected", () => {
    expect(sessionReason("ended", "a")).not.toBe(sessionReason("none-selected", "a"));
  });

  it("asks for an actor first when none is selected", () => {
    expect(sessionReason("none-selected", null)).toContain("Select an actor");
  });
});

describe("isStaleSelection", () => {
  it("is true only when a stored value was rejected", () => {
    expect(isStaleSelection("missing")).toBe(true);
    expect(isStaleSelection("ended")).toBe(true);
    expect(isStaleSelection("wrong-actor")).toBe(true);
  });

  it("is false when nothing was selected or the session resolved", () => {
    expect(isStaleSelection("none-selected")).toBe(false);
    expect(isStaleSelection(null)).toBe(false);
  });
});

describe("selectableSessions", () => {
  it("offers only active sessions owned by the actor", () => {
    const list = [
      session({ id: "a" }),
      session({ id: "b", status: "ended" }),
      session({ id: "c", agent_id: "david" }),
    ];
    expect(selectableSessions(list, "local-operator").map((s) => s.id)).toEqual(["a"]);
  });

  it("offers nothing without an actor", () => {
    expect(selectableSessions([session()], null)).toEqual([]);
  });

  it("never offers a session the resolver would reject", () => {
    const list = [session({ id: "a" }), session({ id: "b", status: "ended" })];
    for (const candidate of selectableSessions(list, "local-operator")) {
      expect(resolveSession(candidate.id, "local-operator", list).sessionId).toBe(candidate.id);
    }
  });
});
