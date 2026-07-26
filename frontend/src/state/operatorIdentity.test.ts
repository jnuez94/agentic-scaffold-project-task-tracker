import { describe, expect, it } from "vitest";
import type { Agent, Session } from "../api/contract.ts";
import {
  CONSOLE_HARNESS,
  createOperatorRequest,
  evaluateOperator,
  findReusableSession,
  LOCAL_OPERATOR,
  newSessionId,
} from "./operatorIdentity.ts";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: LOCAL_OPERATOR.id,
    name: LOCAL_OPERATOR.name,
    role: LOCAL_OPERATOR.role,
    actor_type: "human",
    status: "active",
    responsibilities: "",
    goal: "",
    operating_style: "",
    decision_authority: "",
    review_authority: "",
    escalation_rules: "",
    unavailable_for: "",
    created_at: "2026-07-25T00:00:00+00:00",
    updated_at: "2026-07-25T00:00:00+00:00",
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "console-20260725-100000",
    agent_id: LOCAL_OPERATOR.id,
    harness: CONSOLE_HARNESS,
    model: "",
    status: "active",
    started_at: "2026-07-25T10:00:00+00:00",
    last_seen_at: "2026-07-25T10:00:00+00:00",
    ended_at: null,
    ...overrides,
  };
}

describe("evaluateOperator — clean database", () => {
  it("reports missing when no operator exists", () => {
    expect(evaluateOperator([])).toEqual({ kind: "missing" });
  });

  it("reports missing when other agents exist but not the operator", () => {
    expect(evaluateOperator([agent({ id: "david", actor_type: "ai" })])).toEqual({
      kind: "missing",
    });
  });
});

describe("evaluateOperator — existing record", () => {
  it("treats a matching active human actor as ready", () => {
    const existing = agent();
    expect(evaluateOperator([existing])).toEqual({ kind: "ready", agent: existing });
  });

  it("accepts a personalized name and role without complaint", () => {
    // Only authority-bearing fields gate startup; a renamed operator is fine.
    const renamed = agent({ name: "Josh", role: "Maintainer" });
    expect(evaluateOperator([renamed]).kind).toBe("ready");
  });
});

describe("evaluateOperator — conflict", () => {
  it("refuses to adopt an id registered as an ai actor", () => {
    const result = evaluateOperator([agent({ actor_type: "ai" })]);
    expect(result.kind).toBe("conflict");
    if (result.kind === "conflict") expect(result.reason).toContain("actor_type");
  });

  it("refuses to adopt an id registered as a service actor", () => {
    expect(evaluateOperator([agent({ actor_type: "service" })]).kind).toBe("conflict");
  });

  it("refuses to silently reactivate an inactive operator", () => {
    const result = evaluateOperator([agent({ status: "inactive" })]);
    expect(result.kind).toBe("conflict");
    if (result.kind === "conflict") expect(result.reason).toContain("inactive");
  });

  it("never proposes a repair, only a report", () => {
    const result = evaluateOperator([agent({ actor_type: "ai" })]);
    expect(Object.keys(result)).toEqual(["kind", "reason"]);
  });
});

describe("findReusableSession", () => {
  it("returns null when there is nothing to reuse", () => {
    expect(findReusableSession([], LOCAL_OPERATOR.id)).toBeNull();
  });

  it("adopts an active console session for the operator", () => {
    const existing = session();
    expect(findReusableSession([existing], LOCAL_OPERATOR.id)).toEqual(existing);
  });

  it("ignores ended sessions", () => {
    expect(
      findReusableSession([session({ status: "ended" })], LOCAL_OPERATOR.id),
    ).toBeNull();
  });

  it("ignores sessions belonging to another actor", () => {
    expect(findReusableSession([session({ agent_id: "david" })], LOCAL_OPERATOR.id)).toBeNull();
  });

  it("ignores sessions from another harness", () => {
    // A CLI session belongs to that process; adopting it would misattribute work.
    expect(
      findReusableSession([session({ harness: "claude-code" })], LOCAL_OPERATOR.id),
    ).toBeNull();
  });

  it("prefers the most recently seen candidate", () => {
    const older = session({ id: "console-a", last_seen_at: "2026-07-25T09:00:00+00:00" });
    const newer = session({ id: "console-b", last_seen_at: "2026-07-25T11:00:00+00:00" });
    expect(findReusableSession([older, newer], LOCAL_OPERATOR.id)?.id).toBe("console-b");
  });

  it("breaks ties deterministically by id", () => {
    const a = session({ id: "console-a" });
    const b = session({ id: "console-b" });
    expect(findReusableSession([b, a], LOCAL_OPERATOR.id)?.id).toBe("console-a");
  });
});

describe("newSessionId", () => {
  it("satisfies the contract's identifier grammar", () => {
    const id = newSessionId(new Date(2026, 6, 25, 9, 5, 3));
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/);
  });

  it("encodes the timestamp with zero padding", () => {
    expect(newSessionId(new Date(2026, 6, 25, 9, 5, 3))).toBe("console-20260725-090503");
  });
});

describe("createOperatorRequest", () => {
  it("requests exactly the contracted identity", () => {
    const request = createOperatorRequest();
    expect(request["id"]).toBe("local-operator");
    expect(request["name"]).toBe("Local Operator");
    expect(request["role"]).toBe("Human Operator");
    expect(request["actor_type"]).toBe("human");
  });

  it("does not claim the operator is an authenticated person", () => {
    const values = Object.values(createOperatorRequest()).join(" ").toLowerCase();
    expect(values).not.toContain("you");
    expect(values).not.toContain("authenticated");
  });
});
