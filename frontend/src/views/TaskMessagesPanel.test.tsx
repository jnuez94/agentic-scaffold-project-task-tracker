/**
 * The task inspector's Messages tab (UI-74): one request for the task's
 * messages, newest first, the Messages route's row treatment, nothing to
 * compose and nothing unread.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { Message } from "../api/contract.ts";
import { BROADCAST_HINT } from "../lib/copy.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { TaskMessagesPanel } from "./TaskMessagesPanel.tsx";
import { TASK_TABS } from "./TaskTabs.tsx";

const message = (overrides: Partial<Message>): Message => ({
  id: "m-1",
  sender_id: "alice",
  recipient: "team",
  task_id: "T-1",
  body: "first word",
  tags: "",
  created_at: "2026-09-15T10:00:00+00:00",
  ...overrides,
});

// As the CLI lists them: oldest first.
const THREAD = [
  message({ id: "m-1", body: "first word", created_at: "2026-09-15T10:00:00+00:00" }),
  message({ id: "m-2", sender_id: "bob", recipient: "alice", body: "a reply", created_at: "2026-09-15T11:00:00+00:00" }),
];

function messagesFetch(rows: Message[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const isMessages = url.includes("/api/messages");
    if (isMessages) calls.push(url);
    return new Response(JSON.stringify({ ok: true, data: isMessages ? rows : [] }), { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

const names = (id: string) => ({ alice: "Alice", bob: "Bob" })[id] ?? id;

describe("TaskMessagesPanel", () => {
  it("asks for the task's messages and shows them newest first", async () => {
    const { impl, calls } = messagesFetch(THREAD);
    render(wrap(impl, <TaskMessagesPanel taskId="T-1" nameFor={names} />));

    await screen.findByText("a reply");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("task=T-1");
    expect(calls[0]).toContain("limit=500");
    const bodies = screen.getAllByText(/first word|a reply/).map((el) => el.textContent);
    expect(bodies).toEqual(["a reply", "first word"]);
  });

  it("shows sender and recipient with the Messages route's row treatment", async () => {
    const { impl } = messagesFetch(THREAD);
    render(wrap(impl, <TaskMessagesPanel taskId="T-1" nameFor={names} />));

    await screen.findByText("a reply");
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("team").className).toContain("to-team");
    expect(document.querySelectorAll(".transcript .entry")).toHaveLength(2);
    // Every row is about this task, so the task meta is left off.
    expect(screen.queryByText(/Task:/)).toBeNull();
  });

  it("says how many are loaded and offers no compose control", async () => {
    const { impl } = messagesFetch(THREAD);
    render(wrap(impl, <TaskMessagesPanel taskId="T-1" nameFor={names} />));

    await screen.findByText("2 messages loaded");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("has an empty state that points at Broadcast", async () => {
    const { impl } = messagesFetch([]);
    render(wrap(impl, <TaskMessagesPanel taskId="T-1" nameFor={names} />));

    await screen.findByText("No messages name this task");
    expect(screen.getByText(BROADCAST_HINT)).toBeTruthy();
  });

  it("is reachable as a tab between Reviews and Activity", () => {
    const ids = TASK_TABS.map((tab) => tab.id);
    expect(ids.indexOf("messages")).toBe(ids.indexOf("reviews") + 1);
    expect(ids.indexOf("activity")).toBe(ids.indexOf("messages") + 1);
    expect(TASK_TABS.find((tab) => tab.id === "messages")?.count).toBeUndefined();
  });
});
