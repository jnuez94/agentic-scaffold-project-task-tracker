import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { describeAuditChanges, namedActors } from "./boardChanges.ts";

const entry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  actor: "david",
  session_id: null,
  action: "status",
  object_type: "task",
  object_id: "T-1",
  detail: "",
  created_at: "2026-09-16T00:00:00+00:00",
  ...overrides,
});

describe("describeAuditChanges", () => {
  it("counts records by type, largest first, and names the actors", () => {
    const text = describeAuditChanges([
      entry({ object_id: "T-1" }),
      entry({ object_id: "T-2", actor: "toby" }),
      entry({ object_id: "T-1", action: "update" }), // the same task twice is one task
      entry({ object_type: "review", object_id: "REV-1", action: "add", actor: "toby" }),
    ]);
    expect(text).toBe("2 tasks and 1 review changed, by david and toby");
  });

  it("uses the singular for one record and joins three types with commas", () => {
    expect(describeAuditChanges([entry({})])).toBe("1 task changed, by david");
    expect(
      describeAuditChanges([
        entry({}),
        entry({ object_type: "decision", object_id: "D-1" }),
        entry({ object_type: "message", object_id: "m-1", action: "send" }),
      ]),
    ).toBe("1 decision, 1 message and 1 task changed, by david");
  });

  it("does not count heartbeats, alone or among changes", () => {
    expect(describeAuditChanges([entry({ action: "heartbeat", object_type: "session", object_id: "s" })])).toBe("");
    expect(
      describeAuditChanges([
        entry({ action: "heartbeat", object_type: "session", object_id: "s", actor: "bot" }),
        entry({}),
      ]),
    ).toBe("1 task changed, by david");
  });

  it("knows the irregular plurals", () => {
    expect(
      describeAuditChanges([
        entry({ object_type: "dependency", object_id: "a" }),
        entry({ object_type: "dependency", object_id: "b" }),
      ]),
    ).toBe("2 dependencies changed, by david");
  });
});

describe("namedActors", () => {
  it("names one or two actors and counts the rest", () => {
    expect(namedActors(["michael-ux"])).toBe("michael-ux");
    expect(namedActors(["david", "toby"])).toBe("david and toby");
    expect(namedActors(["david", "michael-ux", "toby"])).toBe("david, michael-ux and 1 other");
    expect(namedActors(["a", "b", "c", "d"])).toBe("a, b and 2 others");
  });
});
