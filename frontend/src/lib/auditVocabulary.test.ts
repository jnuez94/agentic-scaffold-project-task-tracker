import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AUDIT_OBJECT_TYPES,
  auditRequestParams,
  auditWindowNoun,
} from "./auditVocabulary.ts";

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
    expect(auditRequestParams({ objectType: "", action: "" })).toEqual({});
    expect(auditRequestParams({ objectType: "task", action: "" })).toEqual({ object_type: "task" });
    expect(auditRequestParams({ objectType: "task", action: "claim" })).toEqual({
      object_type: "task",
      action: "claim",
    });
  });
});

describe("auditWindowNoun", () => {
  it("names the narrowing in the order type, action", () => {
    expect(auditWindowNoun({ objectType: "", action: "" })).toBe("");
    expect(auditWindowNoun({ objectType: "task", action: "" })).toBe("task events");
    expect(auditWindowNoun({ objectType: "", action: "claim" })).toBe("claim events");
    expect(auditWindowNoun({ objectType: "task", action: "claim" })).toBe("task claim events");
  });
});
