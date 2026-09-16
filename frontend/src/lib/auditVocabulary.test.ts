import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_OBJECT_TYPES,
  auditRequestParams,
  auditWindowNoun,
  heartbeatsHidden,
} from "./auditVocabulary.ts";

const shown = { showHeartbeats: true };

describe("audit vocabulary", () => {
  it("is sorted and free of duplicates, so the pickers read as a fixed set", () => {
    for (const list of [AUDIT_OBJECT_TYPES, AUDIT_ACTIONS]) {
      expect([...list]).toEqual([...new Set(list)].sort());
    }
  });

  it("covers the events the console itself produces", () => {
    for (const action of ["claim", "status", "heartbeat", "send", "mark_read"]) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
    for (const type of ["task", "session", "message", "evidence", "dependency"]) {
      expect(AUDIT_OBJECT_TYPES).toContain(type);
    }
  });
});

describe("auditRequestParams", () => {
  it("sends only the pickers that are set", () => {
    expect(auditRequestParams({ objectType: "", action: "", ...shown })).toEqual({});
    expect(auditRequestParams({ objectType: "task", action: "", ...shown })).toEqual({
      object_type: "task",
    });
    expect(auditRequestParams({ objectType: "task", action: "claim", ...shown })).toEqual({
      object_type: "task",
      action: "claim",
    });
  });

  it("excludes heartbeats by default, in the request", () => {
    expect(auditRequestParams({ objectType: "", action: "", showHeartbeats: false })).toEqual({
      exclude_action: "heartbeat",
    });
  });

  it("does not exclude what the action picker asked for", () => {
    const filters = { objectType: "", action: "heartbeat", showHeartbeats: false };
    expect(auditRequestParams(filters)).toEqual({ action: "heartbeat" });
    expect(heartbeatsHidden(filters)).toBe(false);
  });
});

describe("auditWindowNoun", () => {
  it("names the narrowing in the order type, action", () => {
    expect(auditWindowNoun({ objectType: "", action: "", ...shown })).toBe("");
    expect(auditWindowNoun({ objectType: "task", action: "", ...shown })).toBe("task events");
    expect(auditWindowNoun({ objectType: "", action: "claim", ...shown })).toBe("claim events");
    expect(auditWindowNoun({ objectType: "task", action: "claim", ...shown })).toBe(
      "task claim events",
    );
  });
});
