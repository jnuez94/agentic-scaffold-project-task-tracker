import { describe, expect, it } from "vitest";
import type { Agent } from "../api/contract.ts";
import {
  broadcastReadiness,
  buildBroadcastRequest,
  checkBody,
  requiresNewId,
  TEAM_RECIPIENT,
} from "./broadcast.ts";
import { newBroadcastId, randomSuffix } from "./messageId.ts";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "local-operator",
    name: "Local Operator",
    role: "Human Operator",
    actor_type: "human",
    status: "active",
    responsibilities: "",
    goal: "",
    operating_style: "",
    decision_authority: "",
    review_authority: "",
    escalation_rules: "",
    unavailable_for: "",
    created_at: "2026-07-26T00:00:00+00:00",
    updated_at: "2026-07-26T00:00:00+00:00",
    ...overrides,
  };
}

const READY = { actor: agent(), sessionId: "console-1", mutationsEnabled: true };

describe("broadcastReadiness", () => {
  it("allows an active human actor with a session", () => {
    expect(broadcastReadiness(READY)).toEqual({ kind: "ready", senderId: "local-operator" });
  });

  it("blocks an AI actor from the human broadcast action", () => {
    const result = broadcastReadiness({ ...READY, actor: agent({ actor_type: "ai", name: "David" }) });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toContain("human actor");
  });

  it("blocks a service actor", () => {
    expect(broadcastReadiness({ ...READY, actor: agent({ actor_type: "service" }) }).kind).toBe(
      "blocked",
    );
  });

  it("blocks an inactive human actor", () => {
    const result = broadcastReadiness({ ...READY, actor: agent({ status: "inactive" }) });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toContain("inactive");
  });

  it("blocks when no actor is selected", () => {
    expect(broadcastReadiness({ ...READY, actor: undefined }).kind).toBe("blocked");
  });

  it("blocks when no session is resolved", () => {
    const result = broadcastReadiness({ ...READY, sessionId: null });
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") expect(result.reason).toContain("session");
  });

  it("blocks while identity bootstrap is still running", () => {
    expect(broadcastReadiness({ ...READY, mutationsEnabled: false }).kind).toBe("blocked");
  });

  it("never describes the local actor as authenticated or authorized", () => {
    const reasons = [
      broadcastReadiness({ ...READY, actor: agent({ actor_type: "ai" }) }),
      broadcastReadiness({ ...READY, sessionId: null }),
      broadcastReadiness({ ...READY, actor: undefined }),
    ]
      .map((r) => (r.kind === "blocked" ? r.reason : ""))
      .join(" ")
      .toLowerCase();
    for (const forbidden of ["authenticat", "verified identity", "authoriz", "permission"]) {
      expect(reasons).not.toContain(forbidden);
    }
  });
});

describe("checkBody", () => {
  it("accepts text and returns it trimmed", () => {
    expect(checkBody("  hello team  ")).toEqual({ valid: true, body: "hello team" });
  });

  it("rejects an empty body", () => {
    expect(checkBody("").valid).toBe(false);
  });

  it("rejects a whitespace-only body", () => {
    expect(checkBody("   \n\t ").valid).toBe(false);
  });
});

describe("buildBroadcastRequest", () => {
  it("always addresses the literal team recipient", () => {
    const request = buildBroadcastRequest("m-1", "local-operator", { body: "hi" });
    expect(request.recipient).toBe(TEAM_RECIPIENT);
    expect(request.recipient).toBe("team");
  });

  it("cannot have its recipient overridden by draft input", () => {
    const request = buildBroadcastRequest("m-1", "local-operator", {
      body: "hi",
      // @ts-expect-error deliberately passing a field the type does not allow
      recipient: "someone-else",
    });
    expect(request.recipient).toBe("team");
  });

  it("carries the resolved id and sender", () => {
    const request = buildBroadcastRequest("m-2", "local-operator", { body: "hi" });
    expect(request.id).toBe("m-2");
    expect(request.sender).toBe("local-operator");
  });

  it("trims the body", () => {
    expect(buildBroadcastRequest("m-3", "s", { body: "  padded  " }).body).toBe("padded");
  });

  it("includes optional task and tags when present", () => {
    const request = buildBroadcastRequest("m-4", "s", { body: "b", task: "UI-7", tags: "status" });
    expect(request.task).toBe("UI-7");
    expect(request.tags).toBe("status");
  });

  it("omits blank optional fields rather than sending empties", () => {
    const request = buildBroadcastRequest("m-5", "s", { body: "b", task: "  ", tags: "" });
    expect(request).not.toHaveProperty("task");
    expect(request).not.toHaveProperty("tags");
  });
});

describe("requiresNewId", () => {
  it("mints a new id only after a duplicate-id conflict", () => {
    expect(requiresNewId("constraint_violation")).toBe(true);
  });

  it("reuses the id for every other failure", () => {
    for (const code of ["database_busy", "network_error", "invalid_arguments", undefined]) {
      expect(requiresNewId(code)).toBe(false);
    }
  });
});

describe("newBroadcastId", () => {
  it("satisfies the contract identifier grammar", () => {
    expect(newBroadcastId(new Date(2026, 6, 26, 9, 5, 3))).toMatch(
      /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/,
    );
  });

  it("encodes a readable timestamp", () => {
    expect(newBroadcastId(new Date(2026, 6, 26, 9, 5, 3), () => 0)).toBe(
      "bcast-20260726-090503-aaaa",
    );
  });

  it("differs for two sends inside the same second", () => {
    const at = new Date(2026, 6, 26, 9, 5, 3);
    const values = new Set([newBroadcastId(at), newBroadcastId(at), newBroadcastId(at)]);
    expect(values.size).toBeGreaterThan(1);
  });

  it("produces a suffix of the requested length from the alphabet", () => {
    expect(randomSuffix(6, () => 0.5)).toHaveLength(6);
    expect(randomSuffix(4)).toMatch(/^[a-z0-9]{4}$/);
  });
});
