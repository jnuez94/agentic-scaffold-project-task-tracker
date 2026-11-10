/**
 * The newest-first window (UI-86): one page, then older pages that start on
 * the last row held, a re-read when the rows before it moved, no paging while
 * a new query loads, and a board-change anchor that appending never moves.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { useBoardWatch } from "./useBoardWatch.ts";
import { useListWindow } from "./useListWindow.ts";

type Row = { id: string };
type Page = { limit: number; offset: number };
const named = (...ids: string[]): Row[] => ids.map((id) => ({ id }));
const ids = (rows: Row[] | undefined) => (rows ?? []).map((row) => row.id);

/** A list the test changes underneath the hook, newest first, paged by offset. */
function server(initial: string[]) {
  let rows = named(...initial);
  const asked: Page[] = [];
  return {
    asked,
    load: (page: Page) => {
      asked.push(page);
      return Promise.resolve(rows.slice(page.offset, page.offset + page.limit));
    },
    set: (next: string[]) => {
      rows = named(...next);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useListWindow", () => {
  it("reads the newest page, then the next one starting on the last row held", async () => {
    const list = server(["R-0", "R-1", "R-2", "R-3", "R-4"]);
    const { result } = renderHook(() => useListWindow(list.load, (row) => row.id, [], { pageSize: 3 }));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(ids(result.current.data)).toEqual(["R-0", "R-1", "R-2"]);
    expect(result.current.exhausted).toBe(false);

    // The older page repeats R-2 to prove nothing before it moved, so it adds two.
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.data).toHaveLength(5));
    expect(ids(result.current.data)).toEqual(["R-0", "R-1", "R-2", "R-3", "R-4"]);
    expect(result.current.exhausted).toBe(false);

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(list.asked).toEqual([
      { limit: 3, offset: 0 },
      { limit: 3, offset: 2 },
      { limit: 3, offset: 4 },
    ]);
    expect(ids(result.current.data)).toEqual(["R-0", "R-1", "R-2", "R-3", "R-4"]);
  });

  it("keeps the rows exact when new ones arrive at the top", async () => {
    const list = server(["R-2", "R-3", "R-4", "R-5"]);
    const { result } = renderHook(() => useListWindow(list.load, (row) => row.id, [], { pageSize: 2 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    list.set(["R-0", "R-1", "R-2", "R-3", "R-4", "R-5"]);
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(false));
    // The rows before the last one held moved, so the window is read again
    // from the top: the new rows come in, nothing is skipped or doubled.
    expect(ids(result.current.data)).toEqual(["R-0", "R-1", "R-2", "R-3"]);
  });

  it("does not skip an unseen row when a loaded one leaves the filter", async () => {
    // 6 open tasks, pages of 3. T-1 is done after the first page loads, which
    // shifts every later row up by one: offset 3 would now start at T-5 and
    // skip T-4.
    const list = server(["T-1", "T-2", "T-3", "T-4", "T-5", "T-6"]);
    const { result } = renderHook(() => useListWindow(list.load, (row) => row.id, [], { pageSize: 3 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(ids(result.current.data)).toEqual(["T-1", "T-2", "T-3"]);

    list.set(["T-2", "T-3", "T-4", "T-5", "T-6"]);
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(false));
    expect(ids(result.current.data)).toEqual(["T-2", "T-3", "T-4", "T-5", "T-6"]);
    expect(result.current.exhausted).toBe(true);
  });

  it("refuses to page while a new query loads, and never mixes two queries' rows", async () => {
    // The second query's first page is held back until the test releases it.
    let release: (rows: Row[]) => void = () => {};
    const load = vi.fn((query: string, page: Page) => {
      if (query === "b" && page.offset === 0) return new Promise<Row[]>((resolve) => (release = resolve));
      const rows = named(...[0, 1, 2, 3].map((index) => `${query}-${index}`));
      return Promise.resolve(rows.slice(page.offset, page.offset + page.limit));
    });
    const { result, rerender } = renderHook(
      ({ query }) => useListWindow((page) => load(query, page), (row) => row.id, [query], { pageSize: 2 }),
      { initialProps: { query: "a" } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));

    rerender({ query: "b" });
    act(() => result.current.loadOlder());
    // Refused: no older page of either query was asked for.
    expect(load.mock.calls.filter(([, page]) => page.offset > 0)).toHaveLength(0);

    await act(async () => release(named("b-0", "b-1")));
    await waitFor(() => expect(ids(result.current.data)).toEqual(["b-0", "b-1"]));
  });

  it("drops an older page of the previous query that lands after a new one started", async () => {
    let releaseOlder: (rows: Row[]) => void = () => {};
    const load = (query: string, page: Page) => {
      if (query === "a" && page.offset > 0) return new Promise<Row[]>((resolve) => (releaseOlder = resolve));
      return Promise.resolve(named(`${query}-0`, `${query}-1`));
    };
    const { result, rerender } = renderHook(
      ({ query }) => useListWindow((page) => load(query, page), (row) => row.id, [query], { pageSize: 2 }),
      { initialProps: { query: "a" } },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.loadOlder());

    rerender({ query: "b" });
    await waitFor(() => expect(ids(result.current.data)).toEqual(["b-0", "b-1"]));
    await act(async () => releaseOlder(named("a-1", "a-2")));
    expect(ids(result.current.data)).toEqual(["b-0", "b-1"]);
  });

  it("goes back to the newest page on refresh", async () => {
    const list = server(["R-0", "R-1", "R-2", "R-3"]);
    const { result } = renderHook(() => useListWindow(list.load, (row) => row.id, [], { pageSize: 2 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.data).toHaveLength(3));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data).toHaveLength(2));
  });

  it("moves lastUpdated on the newest page only, so loading older keeps a board-change notice", async () => {
    vi.useFakeTimers();
    const settle = async () => {
      await act(async () => {
        for (let i = 0; i < 30; i += 1) await Promise.resolve();
      });
    };
    const list = server(["T-1", "T-2", "T-3", "T-4"]);
    let head = 10;
    const changes: AuditEntry[] = [];
    const source = {
      head: () => Promise.resolve(head),
      changes: (since: number) => Promise.resolve(changes.filter((row) => row.id > since)),
    };
    const { result } = renderHook(() => {
      const window = useListWindow(list.load, (row) => row.id, [], { pageSize: 2 });
      const watch = useBoardWatch(source, window.lastUpdated, { enabled: window.loaded, intervalMs: 1000 });
      return { window, watch };
    });
    await settle();
    expect(result.current.window.loaded).toBe(true);

    // Someone moves a task, and the next poll notices.
    head = 11;
    changes.push({
      id: 11, actor: "toby", session_id: null, action: "status", object_type: "task",
      object_id: "T-1", detail: "todo -> in_progress", created_at: "2026-11-10T00:00:00+00:00",
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await settle();
    expect(result.current.watch.summary).toMatch(/1 task changed/);

    const anchor = result.current.window.lastUpdated;
    act(() => result.current.window.loadOlder());
    await settle();
    expect(result.current.window.data).toHaveLength(3);
    expect(result.current.window.lastUpdated).toBe(anchor);
    // The rows already shown are still stale, so the notice stays.
    expect(result.current.watch.summary).toMatch(/1 task changed/);
  });

  it("refuses to page after a replacement query fails, while still showing the old rows", async () => {
    // Query a reads [A1, A2, S]; query b would read [B1, B2, S, B3] but its
    // first page fails. Paging from the held rows would stitch b's S, B3 onto
    // a's rows, since both share S at the boundary.
    const rows: Record<string, string[]> = { a: ["A1", "A2", "S"], b: ["B1", "B2", "S", "B3"] };
    let failB = true;
    const load = vi.fn((query: string, page: Page) => {
      if (query === "b" && page.offset === 0 && failB) return Promise.reject(new Error("offline"));
      return Promise.resolve(named(...rows[query]!.slice(page.offset, page.offset + page.limit)));
    });
    const { result, rerender } = renderHook(
      ({ query }) => useListWindow((page) => load(query, page), (row) => row.id, [query], { pageSize: 3 }),
      { initialProps: { query: "a" } },
    );
    await waitFor(() => expect(result.current.pageable).toBe(true));

    rerender({ query: "b" });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(ids(result.current.data)).toEqual(["A1", "A2", "S"]);
    expect(result.current.pageable).toBe(false);

    act(() => result.current.loadOlder());
    expect(load.mock.calls.filter(([, page]) => page.offset > 0)).toHaveLength(0);
    expect(ids(result.current.data)).toEqual(["A1", "A2", "S"]);
    expect(result.current.error).toBeDefined();

    // Once b's first page succeeds, paging follows b.
    failB = false;
    act(() => result.current.refresh());
    await waitFor(() => expect(ids(result.current.data)).toEqual(["B1", "B2", "S"]));
    await waitFor(() => expect(result.current.pageable).toBe(true));
    act(() => result.current.loadOlder());
    await waitFor(() => expect(ids(result.current.data)).toEqual(["B1", "B2", "S", "B3"]));
  });

  it("does not skip a row when the set changes again between the pages of a re-read", async () => {
    // 8 open tasks, pages of 3. T-1 is done after the first page, which sends
    // Load older to a re-read from the top. T-2 is done after the re-read's
    // first page: plain offsets would then skip T-5.
    const all = ["T-1", "T-2", "T-3", "T-4", "T-5", "T-6", "T-7", "T-8"];
    let rows = all;
    const asked: Page[] = [];
    let afterNext: (() => void) | null = null;
    const load = (page: Page) => {
      asked.push(page);
      const answer = named(...rows.slice(page.offset, page.offset + page.limit));
      const hook = afterNext;
      afterNext = null;
      hook?.();
      return Promise.resolve(answer);
    };
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 3 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    rows = all.slice(1);
    // The overlap read misses; then T-2 is done once the re-read's first page is in.
    let reads = 0;
    const done = () => {
      reads += 1;
      if (reads === 2) rows = all.slice(2);
      else afterNext = done;
    };
    afterNext = done;
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(false));

    const got = ids(result.current.data);
    // Whatever is shown is a gapless run of the live list from its top.
    expect(got).toEqual(all.slice(2).slice(0, got.length));
    expect(got).toContain("T-5");
    expect(result.current.error).toBeUndefined();
  });

  it("fails the load, keeps the rows and stays pageable when the set moves under every re-read", async () => {
    let shift = 0;
    const load = (page: Page) => {
      const rows = Array.from({ length: 40 }, (_, index) => `T-${index + shift}`);
      shift += 1;
      return Promise.resolve(named(...rows.slice(page.offset, page.offset + page.limit)));
    };
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 3 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const held = ids(result.current.data);

    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.error?.code).toBe("list_moving"));
    expect(ids(result.current.data)).toEqual(held);
    expect(result.current.exhausted).toBe(false);
  });

  it("never shows a row twice when one already read moves below a boundary that still lines up", async () => {
    // Pages of three. The window holds [X, A, B]. X is done, so Load older
    // re-reads from the top and gets [A, B, C]. Then N arrives above and A
    // drops down: [N, B, C, D, A, E, F]. Offset 2 still starts on C, and
    // brings A a second time.
    let rows = ["X", "A", "B", "C", "D", "E", "F"];
    let reads = 0;
    const load = (page: Page) => {
      const answer = named(...rows.slice(page.offset, page.offset + page.limit));
      reads += 1;
      // Read 1: the first page. Read 2: the overlap, which misses. Read 3: the re-read's first page.
      if (reads === 3) rows = ["N", "B", "C", "D", "A", "E", "F"];
      return Promise.resolve(answer);
    };
    const { result } = renderHook(() => useListWindow(load, (row) => row.id, [], { pageSize: 3 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    rows = ["A", "B", "C", "D", "E", "F"];
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(false));

    const got = ids(result.current.data);
    expect(new Set(got).size).toBe(got.length);
    expect(got).toEqual(["N", "B", "C", "D", "A", "E", "F"].slice(0, got.length));
  });

  it("re-reads when an older page brings back a row already held", async () => {
    // Held [A, B, C]. N arrives above and A drops below the boundary:
    // offset 2 still starts on C.
    const list = server(["A", "B", "C", "D", "E", "F"]);
    const { result } = renderHook(() => useListWindow(list.load, (row) => row.id, [], { pageSize: 3 }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    list.set(["N", "B", "C", "D", "A", "E", "F"]);
    act(() => result.current.loadOlder());
    await waitFor(() => expect(result.current.loadingOlder).toBe(false));
    expect(ids(result.current.data)).toEqual(["N", "B", "C", "D", "A", "E", "F"].slice(0, result.current.data!.length));
    expect(ids(result.current.data)).toContain("N");
  });
});
