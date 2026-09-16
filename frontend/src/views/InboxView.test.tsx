/**
 * The inbox as the operator meets it (UI-68): loaded for the acting actor,
 * marked read only on request, honest about the first run and the own-team
 * rule.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { Inbox } from "../api/contract.ts";
import { FIRST_RUN_LINE, OWN_TEAM_RULE } from "../lib/inbox.ts";
import { AppProvider, useApp } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { useInbox } from "../state/useInbox.ts";
import { InboxView } from "./InboxView.tsx";

const envelope = (overrides: Partial<Inbox> = {}): Inbox => ({
  agent: "alice",
  cursor: 0,
  head: 40,
  messages: [
    { id: "m-1", sender_id: "bob", recipient: "team", task_id: "T-1", body: "older word", tags: "", created_at: "2026-09-16T08:00:00+00:00", audit_id: 31 },
    { id: "m-2", sender_id: "alice", recipient: "team", task_id: null, body: "my own broadcast", tags: "", created_at: "2026-09-16T08:30:00+00:00", audit_id: 35 },
    { id: "m-3", sender_id: "carol", recipient: "alice", task_id: null, body: "newer word", tags: "", created_at: "2026-09-16T09:00:00+00:00", audit_id: 39 },
  ],
  ...overrides,
});

function inboxFetch(inbox: Inbox, markStatus = 200) {
  const calls: { url: string; method: string }[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.includes("/api/inbox/mark-read")) {
      const body = markStatus === 200
        ? { ok: true, data: { agent: "alice", previous_cursor: 0, cursor: 40, head: 40 } }
        : { ok: false, error: { code: "cursor_not_monotonic", message: "Inbox cursor for alice is already at 41" } };
      return new Response(JSON.stringify(body), { status: markStatus });
    }
    const data = url.includes("/api/inbox") ? inbox : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function Harness({ onMarked }: { onMarked: (cursor: number) => void }) {
  const { coordination } = useApp();
  const inbox = useInbox(coordination, "alice");
  return <InboxView inbox={inbox} nameFor={(id) => id} onMarked={onMarked} />;
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

describe("InboxView", () => {
  it("lists unread oldest first, hides own team messages and states the rule", async () => {
    const { impl } = inboxFetch(envelope());
    render(wrap(impl, <Harness onMarked={() => {}} />));

    await screen.findByText("older word");
    const bodies = screen.getAllByText(/older word|newer word|my own broadcast/).map((el) => el.textContent);
    expect(bodies).toEqual(["older word", "newer word"]);
    expect(screen.getByText(OWN_TEAM_RULE)).toBeTruthy();
    expect(screen.getByText("2 unread loaded")).toBeTruthy();
  });

  it("explains the first run when the cursor is at zero with a head", async () => {
    const { impl } = inboxFetch(envelope());
    render(wrap(impl, <Harness onMarked={() => {}} />));
    await screen.findByText(FIRST_RUN_LINE);
  });

  it("does not explain a first run once the cursor has moved", async () => {
    const { impl } = inboxFetch(envelope({ cursor: 12 }));
    render(wrap(impl, <Harness onMarked={() => {}} />));
    await screen.findByText("older word");
    expect(screen.queryByText(FIRST_RUN_LINE)).toBeNull();
  });

  it("never marks read by rendering", async () => {
    const { impl, calls } = inboxFetch(envelope());
    render(wrap(impl, <Harness onMarked={() => {}} />));
    await screen.findByText("older word");
    expect(calls.filter((call) => call.url.includes("mark-read"))).toHaveLength(0);
  });

  it("marks all read with the head from the list, then reports the cursor", async () => {
    const { impl, calls } = inboxFetch(envelope());
    const onMarked = vi.fn();
    render(wrap(impl, <Harness onMarked={onMarked} />));
    await screen.findByText("older word");

    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => expect(onMarked).toHaveBeenCalledWith(40));
    const mark = calls.find((call) => call.url.includes("mark-read"));
    expect(mark?.method).toBe("POST");
  });

  it("shows a refused mark with the inbox's own recovery copy", async () => {
    const { impl } = inboxFetch(envelope(), 409);
    render(wrap(impl, <Harness onMarked={() => {}} />));
    await screen.findByText("older word");

    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await screen.findByText("Your inbox moved on; reload to see the newer position.");
  });

  it("has an empty state that promises nothing about delivery", async () => {
    const { impl } = inboxFetch(envelope({ messages: [], cursor: 40 }));
    render(wrap(impl, <Harness onMarked={() => {}} />));
    await screen.findByText("Nothing unread");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mark all as read" }).disabled).toBe(true);
  });
});
