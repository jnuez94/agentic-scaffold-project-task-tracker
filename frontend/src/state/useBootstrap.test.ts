import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Coordination } from "../api/coordination.ts";
import { ApiError } from "../api/errors.ts";
import { CONSOLE_HARNESS, LOCAL_OPERATOR } from "./operatorIdentity.ts";
import { useBootstrap } from "./useBootstrap.ts";

const OPERATOR = {
  id: LOCAL_OPERATOR.id,
  name: LOCAL_OPERATOR.name,
  role: LOCAL_OPERATOR.role,
  actor_type: "human",
  status: "active",
};

const SESSION = {
  id: "console-existing",
  agent_id: LOCAL_OPERATOR.id,
  harness: CONSOLE_HARNESS,
  status: "active",
  last_seen_at: "2026-07-25T10:00:00+00:00",
};

function fake(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { createAgent: 0, startSession: 0, heartbeat: 0 };
  const api = {
    agents: vi.fn().mockResolvedValue([]),
    sessions: vi.fn().mockResolvedValue([]),
    createAgent: vi.fn().mockImplementation(() => {
      calls.createAgent += 1;
      return Promise.resolve({ id: LOCAL_OPERATOR.id });
    }),
    startSession: vi.fn().mockImplementation(() => {
      calls.startSession += 1;
      return Promise.resolve({ id: "console-new" });
    }),
    heartbeatSession: vi.fn().mockImplementation(() => {
      calls.heartbeat += 1;
      return Promise.resolve({ id: SESSION.id });
    }),
    ...overrides,
  };
  return { api: api as unknown as Coordination, calls, spies: api };
}

describe("useBootstrap — clean database", () => {
  it("creates the operator and starts a session", async () => {
    const { api, calls } = fake();
    const onReady = vi.fn();
    const { result } = renderHook(() => useBootstrap(api, onReady));

    expect(result.current.phase.kind).toBe("loading");
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(calls.createAgent).toBe(1);
    expect(calls.startSession).toBe(1);
    if (result.current.phase.kind === "ready") {
      expect(result.current.phase.actorCreated).toBe(true);
      expect(result.current.phase.sessionReused).toBe(false);
      expect(result.current.phase.sessionId).toBe("console-new");
    }
    expect(onReady).toHaveBeenCalledWith(LOCAL_OPERATOR.id, "console-new");
  });
});

describe("useBootstrap — existing identity", () => {
  it("is idempotent: no duplicate actor, no duplicate session", async () => {
    const { api, calls } = fake({
      agents: vi.fn().mockResolvedValue([OPERATOR]),
      sessions: vi.fn().mockResolvedValue([SESSION]),
    });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(calls.createAgent).toBe(0);
    expect(calls.startSession).toBe(0);
    expect(calls.heartbeat).toBe(1);
    if (result.current.phase.kind === "ready") {
      expect(result.current.phase.sessionReused).toBe(true);
      expect(result.current.phase.sessionId).toBe("console-existing");
    }
  });

  it("creates a session when the actor exists but no session does", async () => {
    const { api, calls } = fake({ agents: vi.fn().mockResolvedValue([OPERATOR]) });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(calls.createAgent).toBe(0);
    expect(calls.startSession).toBe(1);
  });

  it("still becomes ready when the heartbeat fails", async () => {
    const { api } = fake({
      agents: vi.fn().mockResolvedValue([OPERATOR]),
      sessions: vi.fn().mockResolvedValue([SESSION]),
      heartbeatSession: vi.fn().mockRejectedValue(new ApiError("database_busy", "busy", 503)),
    });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
});

describe("useBootstrap — conflict", () => {
  it("stops without mutating when the id is not a human actor", async () => {
    const { api, calls } = fake({
      agents: vi.fn().mockResolvedValue([{ ...OPERATOR, actor_type: "ai" }]),
    });
    const onReady = vi.fn();
    const { result } = renderHook(() => useBootstrap(api, onReady));

    await waitFor(() => expect(result.current.phase.kind).toBe("conflict"));
    expect(result.current.ready).toBe(false);
    expect(calls.createAgent).toBe(0);
    expect(calls.startSession).toBe(0);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("stops without mutating when the operator is inactive", async () => {
    const { api, calls } = fake({
      agents: vi.fn().mockResolvedValue([{ ...OPERATOR, status: "inactive" }]),
    });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("conflict"));
    expect(calls.createAgent).toBe(0);
  });
});

describe("useBootstrap — CLI unavailable and retry", () => {
  it("reports the failure without becoming ready", async () => {
    const { api } = fake({
      agents: vi.fn().mockRejectedValue(new ApiError("cli_unavailable", "no cli", 500)),
    });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
    if (result.current.phase.kind === "unavailable") {
      expect(result.current.phase.error.code).toBe("cli_unavailable");
    }
  });

  it("wraps a non-ApiError rejection", async () => {
    const { api } = fake({ agents: vi.fn().mockRejectedValue(new Error("offline")) });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
    if (result.current.phase.kind === "unavailable") {
      expect(result.current.phase.error.code).toBe("network_error");
    }
  });

  it("recovers on retry once the CLI comes back", async () => {
    const agents = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("cli_unavailable", "no cli", 500))
      .mockResolvedValue([OPERATOR]);
    const { api } = fake({ agents, sessions: vi.fn().mockResolvedValue([SESSION]) });
    const { result } = renderHook(() => useBootstrap(api, vi.fn()));

    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
});

/**
 * Concurrent clean launches (UI-18).
 *
 * Two consoles starting together both see the actor missing, and both try to
 * create it. The loser used to fall into a generic "unavailable" screen even
 * though the winner had just created exactly the record it wanted.
 *
 * `constraint_violation` is the contract's stable duplicate-id code. Recovery
 * is bounded to a single re-read and adopts only a record that passes every
 * compatibility check — a duplicate id proves something holds the name, not
 * that it is the identity we would have created.
 */
const duplicate = () => new ApiError("constraint_violation", "UNIQUE constraint failed", 409);

describe("useBootstrap — concurrent launches", () => {
  it("adopts the actor the other instance created", async () => {
    let agentReads = 0;
    const { api, calls } = fake({
      // First read: absent. After the duplicate: present and compatible.
      agents: vi.fn().mockImplementation(() => {
        agentReads += 1;
        return Promise.resolve(agentReads === 1 ? [] : [OPERATOR]);
      }),
      createAgent: vi.fn().mockRejectedValue(duplicate()),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(agentReads).toBe(2);
    expect(calls.startSession).toBe(1);
    if (result.current.phase.kind === "ready") {
      // Adopted, not created: the other instance made it.
      expect(result.current.phase.actorCreated).toBe(false);
    }
  });

  it("refuses to adopt an incompatible actor that happens to hold the id", async () => {
    let agentReads = 0;
    const { api } = fake({
      agents: vi.fn().mockImplementation(() => {
        agentReads += 1;
        return Promise.resolve(agentReads === 1 ? [] : [{ ...OPERATOR, actor_type: "ai" }]);
      }),
      createAgent: vi.fn().mockRejectedValue(duplicate()),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("conflict"));
    // Non-destructive: the mismatch is reported, never repaired.
    expect(result.current.ready).toBe(false);
  });

  it("adopts an active console session after a session id collision", async () => {
    let sessionReads = 0;
    const { api, calls } = fake({
      agents: vi.fn().mockResolvedValue([OPERATOR]),
      sessions: vi.fn().mockImplementation(() => {
        sessionReads += 1;
        return Promise.resolve(sessionReads === 1 ? [] : [SESSION]);
      }),
      startSession: vi.fn().mockRejectedValue(duplicate()),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(sessionReads).toBe(2);
    if (result.current.phase.kind === "ready") {
      expect(result.current.phase.sessionId).toBe(SESSION.id);
      expect(result.current.phase.sessionReused).toBe(true);
    }
    // Adopting keeps it off the stale-session health finding.
    expect(calls.heartbeat).toBeGreaterThan(0);
  });

  it("never adopts a session belonging to another harness", async () => {
    let sessionReads = 0;
    const { api } = fake({
      agents: vi.fn().mockResolvedValue([OPERATOR]),
      sessions: vi.fn().mockImplementation(() => {
        sessionReads += 1;
        return Promise.resolve(
          sessionReads === 1 ? [] : [{ ...SESSION, harness: "some-other-harness" }],
        );
      }),
      startSession: vi.fn().mockRejectedValue(duplicate()),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
  });

  it("never adopts an ended session", async () => {
    let sessionReads = 0;
    const { api } = fake({
      agents: vi.fn().mockResolvedValue([OPERATOR]),
      sessions: vi.fn().mockImplementation(() => {
        sessionReads += 1;
        return Promise.resolve(sessionReads === 1 ? [] : [{ ...SESSION, status: "ended" }]);
      }),
      startSession: vi.fn().mockRejectedValue(duplicate()),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
  });

  it("leaves unexpected failures visible and retryable", async () => {
    // Only the duplicate code is recovered. A CLI outage must not be quietly
    // converted into a success by a re-read that happens to find something.
    const { api } = fake({
      createAgent: vi.fn().mockRejectedValue(new ApiError("cli_unavailable", "no cli", 503)),
    });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
  });

  it("does not retry in a loop: one re-read, then it gives up", async () => {
    const agents = vi.fn().mockResolvedValue([]);
    const { api } = fake({ agents, createAgent: vi.fn().mockRejectedValue(duplicate()) });

    const { result } = renderHook(() => useBootstrap(api, vi.fn()));
    await waitFor(() => expect(result.current.phase.kind).toBe("unavailable"));
    // The re-read still showed nothing, so it stops rather than spinning.
    expect(agents).toHaveBeenCalledTimes(2);
  });
});
