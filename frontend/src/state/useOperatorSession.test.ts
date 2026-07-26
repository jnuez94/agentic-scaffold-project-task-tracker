/**
 * The reconciliation UI-14 is about lives here rather than in resolveSession.
 *
 * resolveSession is pure and already covered; what this hook adds is the part
 * that made the original defect survive a reload: *when* the stored id is
 * trusted, and the side effect that erases it. Those are exactly the two
 * behaviours a unit test can pin down and a screenshot cannot.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Session } from "../api/contract.ts";
import type { Coordination } from "../api/coordination.ts";
import { useOperatorSession } from "./useOperatorSession.ts";

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

/**
 * Only `sessions` is exercised; the rest of the port is irrelevant here.
 *
 * Every caller must hold the returned value in a variable rather than building
 * it inside the render callback: the hook keys its fetch on this object's
 * identity, so a fresh one per render refetches forever. AppContext memoises
 * the real instance for the same reason.
 */
function coordinationReturning(sessions: Session[], delayMs = 0): Coordination {
  return {
    sessions: () =>
      delayMs === 0
        ? Promise.resolve(sessions)
        : new Promise((resolve) =>
            setTimeout(() => resolve(sessions), delayMs),
          ),
  } as unknown as Coordination;
}

describe("useOperatorSession", () => {
  it("resolves an active session belonging to the actor", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([session()]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "console-1", onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.activeSessionId).toBe("console-1");
    expect(result.current.reason).toBeNull();
    // Nothing stale, so persistence is left alone.
    expect(onStaleCleared).not.toHaveBeenCalled();
  });

  it("clears a persisted session that has ended, without waiting for a refresh", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([
      session({ status: "ended", ended_at: "2026-07-26T11:00:00+00:00" }),
    ]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "console-1", onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.activeSessionId).toBeNull();
    expect(result.current.rejection).toBe("ended");
    // The defect this task exists for: the id must not survive the reload.
    await waitFor(() => expect(onStaleCleared).toHaveBeenCalledTimes(1));
  });

  it("clears a persisted session that no longer exists", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "gone", onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.rejection).toBe("missing");
    await waitFor(() => expect(onStaleCleared).toHaveBeenCalledTimes(1));
  });

  it("clears a persisted session belonging to another actor", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([session({ agent_id: "mikhail-ux" })]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "console-1", onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.rejection).toBe("wrong-actor");
    await waitFor(() => expect(onStaleCleared).toHaveBeenCalledTimes(1));
  });

  it("does not present a stored session as active before the list arrives", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([session({ status: "ended" })], 40);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "console-1", onStaleCleared),
    );

    // The original defect was a surface trusting the stored id on first paint.
    // Until the list settles there is nothing to validate against, so the hook
    // must claim neither that the session is active nor that it is stale.
    expect(result.current.loaded).toBe(false);
    expect(result.current.activeSessionId).toBeNull();
    expect(onStaleCleared).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.rejection).toBe("ended");
  });

  it("does not report a stale selection when nothing was stored", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([session()]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", null, onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.rejection).toBe("none-selected");
    // An empty selection is not a stale one; clearing would be a pointless write.
    expect(onStaleCleared).not.toHaveBeenCalled();
  });

  it("clears once per stale resolution rather than on every render", async () => {
    const onStaleCleared = vi.fn();
    const api = coordinationReturning([session({ status: "ended" })]);
    const { result, rerender } = renderHook(() =>
      useOperatorSession(api, "local-operator", "console-1", onStaleCleared),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    rerender();
    rerender();
    expect(onStaleCleared).toHaveBeenCalledTimes(1);
  });

  it("offers only the actor's active sessions for selection", async () => {
    const api = coordinationReturning([
      session({ id: "mine-active" }),
      session({ id: "mine-ended", status: "ended" }),
      session({ id: "theirs", agent_id: "mikhail-ux" }),
    ]);
    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "mine-active", vi.fn()),
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.selectable.map((entry) => entry.id)).toEqual([
      "mine-active",
    ]);
    // The full list stays available so the selector can still explain a
    // session it will not offer.
    expect(result.current.sessions).toHaveLength(3);
  });

  it("re-reads before discarding a session the list has not caught up with", async () => {
    // The clean-launch race: sessions are fetched at mount, bootstrap creates
    // the session a moment later, so the first list cannot contain it. Clearing
    // on that evidence left a ready console showing "No session" with every
    // mutation disabled.
    const onStaleCleared = vi.fn();
    let reads = 0;
    const api = {
      sessions: () => {
        reads += 1;
        // Absent on the first read, present on the confirming one.
        return Promise.resolve(reads === 1 ? [] : [session({ id: "adopted" })]);
      },
    } as unknown as Coordination;

    const { result } = renderHook(() =>
      useOperatorSession(api, "local-operator", "adopted", onStaleCleared),
    );

    await waitFor(() => expect(result.current.activeSessionId).toBe("adopted"));
    expect(reads).toBe(2);
    // The selection survived, because it was never actually stale.
    expect(onStaleCleared).not.toHaveBeenCalled();
  });

  it("still clears a session that is genuinely gone, after confirming once", async () => {
    const onStaleCleared = vi.fn();
    let reads = 0;
    const api = {
      sessions: () => {
        reads += 1;
        return Promise.resolve([]);
      },
    } as unknown as Coordination;

    renderHook(() => useOperatorSession(api, "local-operator", "gone", onStaleCleared));

    await waitFor(() => expect(onStaleCleared).toHaveBeenCalledTimes(1));
    // Exactly one confirming re-read, then the verdict stands. UI-14 still holds.
    expect(reads).toBe(2);
  });
});
