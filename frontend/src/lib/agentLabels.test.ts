import { describe, expect, it } from "vitest";
import type { Agent } from "../api/contract.ts";
import { agentOptionLabel, isSelectableActor } from "./labels.ts";

function agent(over: Partial<Agent>): Agent {
  return {
    id: "someone",
    name: "Someone",
    role: "",
    actor_type: "ai",
    status: "active",
    responsibilities: "",
    goal: "",
    operating_style: "",
    decision_authority: "",
    review_authority: "",
    escalation_rules: "",
    unavailable_for: "",
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("agentOptionLabel", () => {
  it("carries the id, because the name alone is not an identity", () => {
    expect(agentOptionLabel(agent({ id: "toby", name: "Toby" }))).toBe("Toby · toby");
  });

  // The defect this exists for: `toby` and `codex-security` both display as
  // "Toby", so a name-only option gave the operator two identical choices.
  it("distinguishes two records that share a display name", () => {
    const active = agentOptionLabel(agent({ id: "toby", name: "Toby" }));
    const retired = agentOptionLabel(
      agent({ id: "codex-security", name: "Toby", status: "inactive" }),
    );
    expect(active).not.toBe(retired);
    expect(retired).toContain("codex-security");
  });

  it("marks an inactive agent retired rather than inactive", () => {
    expect(agentOptionLabel(agent({ id: "mikhail-ux", name: "Mikhail", status: "inactive" })))
      .toBe("Mikhail · mikhail-ux — retired");
  });

  it("leaves an active agent unqualified", () => {
    expect(agentOptionLabel(agent({ id: "david", name: "David" }))).toBe("David · david");
  });
});

describe("isSelectableActor", () => {
  it("accepts an active agent", () => {
    expect(isSelectableActor(agent({ status: "active" }))).toBe(true);
  });

  // A retired identity must not become the accountable actor on a mutation:
  // attribution is exactly what the audit trail depends on.
  it("rejects a retired agent", () => {
    expect(isSelectableActor(agent({ status: "inactive" }))).toBe(false);
  });
});
