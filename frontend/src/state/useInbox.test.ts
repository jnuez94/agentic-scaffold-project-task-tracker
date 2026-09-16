import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Coordination } from "../api/coordination.ts";
import type { Inbox } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { useInbox } from "./useInbox.ts";

const envelope = (agent: string, head = 20): Inbox => ({
  agent,
  cursor: 0,
  head,
  messages: [
    { id: "m-1", sender_id: "carol", recipient: "team", task_id: null, body: "hi", tags: "", created_at: "2026-09-16T00:00:00+00:00", audit_id: 11 },
    { id: "m-2", sender_id: agent, recipient: "team", task_id: null, body: "mine", tags: "", created_at: "2026-09-16T00:01:00+00:00", audit_id: 12 },
  ],
});

function fakeCoordination(markResult: () => Promise<unknown>) {
  const inbox = vi.fn(async (query: Record<string, unknown>) => envelope(String(query["agent"])));
  const markInboxRead = vi.fn(async (body: unknown) => {
    await markResult();
    const { agent, cursor } = body as { agent: string; cursor: number };
    return { agent, previous_cursor: 0, cursor, head: cursor };
  });
  return { api: { inbox, markInboxRead } as unknown as Coordination, inbox, markInboxRead };
}

describe("useInbox", () => {
  it("is disabled without an actor and makes no request", () => {
    const { api, inbox } = fakeCoordination(async () => undefined);
    const { result } = renderHook(() => useInbox(api, null));
    expect(result.current.enabled).toBe(false);
    expect(result.current.reading).toBeNull();
    expect(inbox).not.toHaveBeenCalled();
  });

  it("loads the actor's inbox and applies the own-team rule", async () => {
    const { api, inbox } = fakeCoordination(async () => undefined);
    const { result } = renderHook(() => useInbox(api, "alice"));
    await waitFor(() => expect(result.current.reading).not.toBeNull());
    expect(inbox).toHaveBeenCalledWith({ agent: "alice", limit: 500 });
    expect(result.current.reading?.visible.map((m) => m.id)).toEqual(["m-1"]);
    expect(result.current.reading?.hiddenOwn).toBe(1);
    expect(result.current.reading?.firstRun).toBe(true);
  });

  it("never marks read by loading or re-rendering", async () => {
    const { api, markInboxRead } = fakeCoordination(async () => undefined);
    const { result, rerender } = renderHook(() => useInbox(api, "alice"));
    await waitFor(() => expect(result.current.reading).not.toBeNull());
    rerender();
    expect(markInboxRead).not.toHaveBeenCalled();
  });

  it("marks all read with the head the list returned, then reloads", async () => {
    const { api, inbox, markInboxRead } = fakeCoordination(async () => undefined);
    const { result } = renderHook(() => useInbox(api, "alice"));
    await waitFor(() => expect(result.current.reading).not.toBeNull());

    let mark: unknown;
    await act(async () => {
      mark = await result.current.markAllRead();
    });
    expect(markInboxRead).toHaveBeenCalledWith({ agent: "alice", cursor: 20 });
    expect(mark).toMatchObject({ cursor: 20 });
    await waitFor(() => expect(inbox).toHaveBeenCalledTimes(2));
  });

  it("keeps a refused mark as an error the view can show", async () => {
    const { api } = fakeCoordination(async () => {
      throw new ApiError("cursor_not_monotonic", "already ahead", 409);
    });
    const { result } = renderHook(() => useInbox(api, "alice"));
    await waitFor(() => expect(result.current.reading).not.toBeNull());

    await act(async () => {
      await result.current.markAllRead();
    });
    expect(result.current.markError?.code).toBe("cursor_not_monotonic");
    expect(result.current.marking).toBe(false);
  });

  it("does not show the previous actor's unread as the new actor's", async () => {
    const { api } = fakeCoordination(async () => undefined);
    const { result, rerender } = renderHook(({ actor }: { actor: string }) => useInbox(api, actor), {
      initialProps: { actor: "alice" },
    });
    await waitFor(() => expect(result.current.reading?.visible).toHaveLength(1));

    rerender({ actor: "bob" });
    // Until bob's envelope lands, nothing is attributed to bob.
    expect(result.current.reading === null || result.current.resource.data?.agent === "bob").toBe(true);
    await waitFor(() => expect(result.current.resource.data?.agent).toBe("bob"));
    expect(result.current.reading?.visible.map((m) => m.id)).toEqual(["m-1"]);
  });
});
