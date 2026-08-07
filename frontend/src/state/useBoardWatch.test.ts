/**
 * Board-change detection (UI-34).
 *
 * The gates matter more than the detection: a poll that fires while a
 * reassignment is half-composed is the failure this feature exists to prevent,
 * so the suppression cases are tested as carefully as the positive one.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardWatch } from "./useBoardWatch.ts";

const row = (id: string, revision = 1) => ({ id, revision });

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Advance past one interval and let the awaited load settle.
 *
 * Deliberately not waitFor: that polls on real timers, which are faked here, so
 * it would hang rather than retry. Flushing the microtask queue inside act is
 * the equivalent that works under fake timers.
 */
async function poll(ms = 60_000) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

describe("useBoardWatch", () => {
  it("says nothing before the first interval elapses", async () => {
    const load = vi.fn(async () => [row("a", 2)]);
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    expect(result.current.summary).toBe("");
    expect(load).not.toHaveBeenCalled();
  });

  it("reports what changed once it polls", async () => {
    const load = vi.fn(async () => [row("a", 2)]);
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(result.current.summary).toBe("1 task changed");
  });

  it("stays quiet when nothing moved", async () => {
    const load = vi.fn(async () => [row("a", 1)]);
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("does not poll while the tab is hidden", async () => {
    setVisibility("hidden");
    const load = vi.fn(async () => [row("a", 2)]);
    renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not poll while a mutation dialog is open", async () => {
    // Refreshing under a half-composed reassignment is the exact failure this
    // feature is supposed to prevent.
    document.body.innerHTML = '<div role="dialog">Change assignees</div>';
    const load = vi.fn(async () => [row("a", 2)]);
    renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(load).not.toHaveBeenCalled();
  });

  it("resumes once the dialog closes", async () => {
    document.body.innerHTML = '<div role="dialog">Change assignees</div>';
    const load = vi.fn(async () => [row("a", 2)]);
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(load).not.toHaveBeenCalled();

    document.body.innerHTML = "";
    await poll();
    expect(result.current.summary).toBe("1 task changed");
  });

  it("never replaces what is on screen — it only reports", async () => {
    // The complaint is rows moving underneath the operator; this must not be
    // another way for that to happen.
    const displayed = [row("a", 1)];
    const load = vi.fn(async () => [row("a", 2)]);
    renderHook(() => useBoardWatch(load, displayed));
    await poll();
    expect(displayed).toEqual([row("a", 1)]);
  });

  it("clears itself when the board comes back into agreement", async () => {
    let remote = [row("a", 2)];
    const load = vi.fn(async () => remote);
    const { result, rerender } = renderHook(
      ({ current }) => useBoardWatch(load, current),
      { initialProps: { current: [row("a", 1)] } },
    );
    await poll();
    expect(result.current.summary).toBe("1 task changed");

    // The operator refreshed: what is displayed now matches the remote.
    rerender({ current: [row("a", 2)] });
    remote = [row("a", 2)];
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("can be dismissed", async () => {
    const load = vi.fn(async () => [row("a", 2)]);
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(result.current.summary).not.toBe("");
    act(() => result.current.dismiss());
    expect(result.current.summary).toBe("");
  });

  it("stays silent when a poll fails", async () => {
    // An unasked-for request failing is not news; the bar is for real changes.
    const load = vi.fn(async () => {
      throw new Error("cli unavailable");
    });
    const { result } = renderHook(() => useBoardWatch(load, [row("a", 1)]));
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("does not poll at all when disabled", async () => {
    const load = vi.fn(async () => [row("a", 2)]);
    renderHook(() => useBoardWatch(load, [row("a", 1)], { enabled: false }));
    await poll();
    expect(load).not.toHaveBeenCalled();
  });
});
