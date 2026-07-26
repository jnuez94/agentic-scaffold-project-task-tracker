import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Agent } from "../api/contract.ts";
import { useBroadcastLauncher } from "./useBroadcastLauncher.ts";

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

describe("useBroadcastLauncher readiness", () => {
  it("is enabled for an active human actor with a resolved session", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    expect(result.current.readiness.kind).toBe("ready");
    expect(result.current.disabledReason).toBeNull();
  });

  it("keeps the trigger disabled with one reason for an AI actor", () => {
    const { result } = renderHook(() =>
      useBroadcastLauncher(agent({ actor_type: "ai", name: "David" }), "console-1", true),
    );
    expect(result.current.readiness.kind).toBe("blocked");
    expect(result.current.disabledReason).toContain("human actor");
  });

  it("is disabled when no session resolved, which is UI-10's contribution", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), null, true));
    expect(result.current.disabledReason).toContain("session");
  });

  it("is disabled while identity bootstrap is still running", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", false));
    expect(result.current.disabledReason).toBeTruthy();
  });

  it("reports exactly one reason at a time", () => {
    const { result } = renderHook(() => useBroadcastLauncher(undefined, null, false));
    expect(typeof result.current.disabledReason).toBe("string");
  });
});

describe("useBroadcastLauncher open state", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    expect(result.current.open).toBe(false);
  });

  it("opens and closes", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    act(() => result.current.onOpen());
    expect(result.current.open).toBe(true);
    act(() => result.current.onClose());
    expect(result.current.open).toBe(false);
  });

  it("returns focus to the toolbar trigger on close", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    const button = document.createElement("button");
    document.body.appendChild(button);
    result.current.triggerRef.current = button;
    act(() => result.current.onOpen());
    act(() => result.current.onClose());
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("does not throw when the trigger is not mounted", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    act(() => result.current.onOpen());
    expect(() => act(() => result.current.onClose())).not.toThrow();
  });
});

describe("useBroadcastLauncher refresh signal", () => {
  it("starts at zero and increments only on a send", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    expect(result.current.sentNonce).toBe(0);
    act(() => result.current.onOpen());
    act(() => result.current.onClose());
    expect(result.current.sentNonce).toBe(0);
    act(() => result.current.onSent());
    expect(result.current.sentNonce).toBe(1);
  });

  it("increments once per send so repeated broadcasts each refresh", () => {
    const { result } = renderHook(() => useBroadcastLauncher(agent(), "console-1", true));
    act(() => result.current.onSent());
    act(() => result.current.onSent());
    expect(result.current.sentNonce).toBe(2);
  });
});
