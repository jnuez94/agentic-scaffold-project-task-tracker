/**
 * Board-change detection (UI-34, on the audit cursor since UI-75).
 *
 * The gates matter more than the detection: a poll that fires while a
 * reassignment is half-composed is the failure this feature exists to prevent,
 * so the suppression cases are tested as carefully as the positive one. Every
 * rule UI-34 established is here; what the watch reads changed underneath them.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { useBoardWatch, type BoardWatchSource } from "./useBoardWatch.ts";

const entry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  id: 11,
  actor: "toby",
  session_id: null,
  action: "status",
  object_type: "task",
  object_id: "T-1",
  detail: "",
  created_at: "2026-09-16T00:00:00+00:00",
  ...overrides,
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

/** A ledger whose head the test moves; `changes` answers with what sits above the cursor. */
function ledger(initialHead = 10) {
  let head = initialHead;
  const rows: AuditEntry[] = [];
  const source: BoardWatchSource = {
    head: vi.fn(async () => head),
    changes: vi.fn(async (since: number) => rows.filter((row) => row.id > since)),
  };
  return {
    source,
    record(row: Partial<AuditEntry>) {
      head += 1;
      rows.push(entry({ ...row, id: head }));
    },
  };
}

/**
 * A stable anchor, as `tasks.data` is between refreshes. A fresh literal on
 * every render would re-anchor the watch each time it announced something.
 */
const DISPLAYED = ["displayed"];

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

/** Let the baseline read settle without advancing the clock. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
}

/**
 * Advance past one interval and let the awaited reads settle. Deliberately not
 * waitFor: that polls on real timers, which are faked here.
 */
async function poll(ms = 60_000) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
  });
}

describe("useBoardWatch", () => {
  it("reads the head once to anchor, and says nothing before the first interval", async () => {
    const { source } = ledger();
    const { result } = renderHook(() => useBoardWatch(source, DISPLAYED));
    await settle();
    expect(result.current.summary).toBe("");
    expect(source.head).toHaveBeenCalledTimes(1);
    expect(source.changes).not.toHaveBeenCalled();
  });

  it("reports what changed, and who changed it, once it polls", async () => {
    const board = ledger();
    const { result } = renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({ object_id: "T-1" });
    board.record({ object_type: "review", object_id: "REV-1", action: "add", actor: "david" });
    await poll();
    expect(result.current.summary).toBe("1 review and 1 task changed — david, toby");
    expect(board.source.changes).toHaveBeenCalledWith(10);
  });

  it("stays quiet when the cursor has not moved", async () => {
    const board = ledger();
    const { result } = renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    await poll();
    expect(result.current.summary).toBe("");
    expect(board.source.changes).not.toHaveBeenCalled();
  });

  it("does not light the marker for heartbeats", async () => {
    const board = ledger();
    const { result } = renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({ action: "heartbeat", object_type: "session", object_id: "s-1" });
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("does not poll while the tab is hidden", async () => {
    setVisibility("hidden");
    const board = ledger();
    renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({});
    await poll();
    expect(board.source.head).toHaveBeenCalledTimes(1); // the anchor only
    expect(board.source.changes).not.toHaveBeenCalled();
  });

  it("does not poll while a mutation dialog is open", async () => {
    document.body.innerHTML = '<div role="dialog">Change assignees</div>';
    const board = ledger();
    renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({});
    await poll();
    expect(board.source.changes).not.toHaveBeenCalled();
  });

  it("resumes once the dialog closes", async () => {
    document.body.innerHTML = '<div role="dialog">Change assignees</div>';
    const board = ledger();
    const { result } = renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({});
    await poll();
    expect(result.current.summary).toBe("");

    document.body.innerHTML = "";
    await poll();
    expect(result.current.summary).toBe("1 task changed — toby");
  });

  it("never replaces what is on screen — it only reports", async () => {
    const displayed = [{ id: "T-1", revision: 1 }];
    const board = ledger();
    renderHook(() => useBoardWatch(board.source, displayed));
    await settle();
    board.record({});
    await poll();
    expect(displayed).toEqual([{ id: "T-1", revision: 1 }]);
  });

  it("re-anchors and clears itself when the operator refreshes", async () => {
    const board = ledger();
    const { result, rerender } = renderHook(({ current }) => useBoardWatch(board.source, current), {
      initialProps: { current: ["v1"] },
    });
    await settle();
    board.record({});
    await poll();
    expect(result.current.summary).toBe("1 task changed — toby");

    rerender({ current: ["v2"] });
    await settle();
    expect(result.current.summary).toBe("");
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("can be dismissed, and the same changes do not light it again", async () => {
    const board = ledger();
    const { result } = renderHook(() => useBoardWatch(board.source, DISPLAYED));
    await settle();
    board.record({});
    await poll();
    expect(result.current.summary).not.toBe("");
    act(() => result.current.dismiss());
    expect(result.current.summary).toBe("");
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("stays silent when a poll fails", async () => {
    const source: BoardWatchSource = {
      head: vi.fn(async () => {
        throw new Error("cli unavailable");
      }),
      changes: vi.fn(async () => []),
    };
    const { result } = renderHook(() => useBoardWatch(source, DISPLAYED));
    await settle();
    await poll();
    expect(result.current.summary).toBe("");
  });

  it("does nothing at all when disabled", async () => {
    const board = ledger();
    renderHook(() => useBoardWatch(board.source, DISPLAYED, { enabled: false }));
    await settle();
    await poll();
    expect(board.source.head).not.toHaveBeenCalled();
  });
});
