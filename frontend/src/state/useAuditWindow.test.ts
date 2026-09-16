import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { useAuditWindow, type AuditQuery } from "./useAuditWindow.ts";

const entry = (id: number): AuditEntry => ({
  id,
  actor: "alice",
  session_id: null,
  action: "create",
  object_type: "task",
  object_id: `T-${id}`,
  detail: "",
  created_at: "2026-09-15T00:00:00+00:00",
});

/** Pages of a descending log: ids from `top` down, `size` per request, bounded by `before`. */
function logOf(top: number, size: number) {
  const calls: AuditQuery[] = [];
  const load = vi.fn(async (query: AuditQuery) => {
    calls.push(query);
    const start = query.before === undefined ? top : query.before - 1;
    const ids = Array.from({ length: Math.min(size, Math.max(0, start)) }, (_, i) => start - i);
    return ids.map(entry);
  });
  return { load, calls };
}

describe("useAuditWindow", () => {
  it("loads the newest page first and knows when the log is longer", async () => {
    const { load, calls } = logOf(1000, 3);
    const { result } = renderHook(() => useAuditWindow(load, 3));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.rows.map((row) => row.id)).toEqual([1000, 999, 998]);
    expect(result.current.exhausted).toBe(false);
    expect(calls).toEqual([{ limit: 3 }]);
  });

  it("appends the page before the oldest id it holds", async () => {
    const { load, calls } = logOf(1000, 3);
    const { result } = renderHook(() => useAuditWindow(load, 3));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.rows).toHaveLength(6));

    expect(result.current.rows.map((row) => row.id)).toEqual([1000, 999, 998, 997, 996, 995]);
    expect(calls[1]).toEqual({ limit: 3, before: 998 });
  });

  it("marks the window exhausted when a page comes back short", async () => {
    const { load } = logOf(4, 3);
    const { result } = renderHook(() => useAuditWindow(load, 3));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.exhausted).toBe(false);

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(result.current.rows.map((row) => row.id)).toEqual([4, 3, 2, 1]);
  });

  it("refresh returns to the newest window and drops what was behind it", async () => {
    const { load, calls } = logOf(1000, 3);
    const { result } = renderHook(() => useAuditWindow(load, 3));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.rows).toHaveLength(6));

    act(() => result.current.refresh());
    await waitFor(() => expect(calls).toHaveLength(3));
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(calls[2]).toEqual({ limit: 3 });
  });

  it("does nothing when there is no oldest row to page back from", async () => {
    const { load, calls } = logOf(0, 3);
    const { result } = renderHook(() => useAuditWindow(load, 3));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.loadOlder());
    expect(calls).toHaveLength(1);
    expect(result.current.exhausted).toBe(true);
  });

  it("starts a fresh window when the request params change, with one request", async () => {
    const { load, calls } = logOf(1000, 3);
    const { result, rerender } = renderHook(
      ({ params }: { params: Record<string, string> }) => useAuditWindow(load, 3, params),
      { initialProps: { params: {} } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.rows).toHaveLength(6));

    rerender({ params: { object_type: "task" } });
    await waitFor(() => expect(calls).toHaveLength(3));
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(calls[2]).toEqual({ limit: 3, object_type: "task" });
    // The key names the window the rows answer, and only once they have landed.
    expect(result.current.windowKey).toBe(JSON.stringify({ object_type: "task" }));

    // The same pickers again, as a new object, are the same window: no request.
    rerender({ params: { object_type: "task" } });
    expect(calls).toHaveLength(3);
  });

  it("surfaces a failed load as an error and keeps what it had", async () => {
    let fail = false;
    const load = vi.fn(async (query: AuditQuery) => {
      if (fail) throw new Error("gone");
      return [entry(query.before === undefined ? 10 : query.before - 1)];
    });
    const { result } = renderHook(() => useAuditWindow(load, 1));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    fail = true;
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toBe("gone");
    expect(result.current.rows.map((row) => row.id)).toEqual([10]);
  });
});
