/**
 * The newest-first window (UI-86): one page, then older pages appended by
 * offset, repeats dropped, and the end stated once a page comes back short.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useListWindow } from "./useListWindow.ts";

type Row = { id: string };
const rows = (from: number, count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({ id: `R-${from + index}` }));

describe("useListWindow", () => {
  it("reads the first page, then appends the next by offset until a short page", async () => {
    const asked: { limit: number; offset: number }[] = [];
    const load = (page: { limit: number; offset: number }) => {
      asked.push(page);
      return Promise.resolve(page.offset === 0 ? rows(0, 3) : rows(3, 2));
    };
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 3 }));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.data?.map((row) => row.id)).toEqual(["R-0", "R-1", "R-2"]);
    expect(result.current.exhausted).toBe(false);

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(asked).toEqual([{ limit: 3, offset: 0 }, { limit: 3, offset: 3 }]);
    expect(result.current.data?.map((row) => row.id)).toEqual(["R-0", "R-1", "R-2", "R-3", "R-4"]);
  });

  it("drops rows repeated because new ones arrived at the top", async () => {
    const load = (page: { limit: number; offset: number }) =>
      // A new row arrived, so the second page starts with a row already held.
      Promise.resolve(page.offset === 0 ? rows(0, 2) : rows(1, 2));
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 2 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(result.current.data?.map((row) => row.id)).toEqual(["R-0", "R-1", "R-2"]);
  });

  it("goes back to the newest page on refresh", async () => {
    let calls = 0;
    const load = (page: { limit: number; offset: number }) => {
      calls += 1;
      return Promise.resolve(page.offset === 0 ? rows(0, 2) : rows(2, 2));
    };
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 2 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.data).toHaveLength(4));

    act(() => result.current.refresh());
    await waitFor(() => expect(calls).toBe(3));
    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });
});
