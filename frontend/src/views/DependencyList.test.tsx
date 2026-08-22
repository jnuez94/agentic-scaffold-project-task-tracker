/**
 * Resolving a dependency inline (UI-50, resolve half).
 *
 * The ruling under test: no confirmation, because resolve is non-destructive —
 * the record is kept — and the control appears only where the CLI would accept
 * it. The wire shape is pinned because the route requires task, depends_on and
 * actor, and silently sending the wrong edge would resolve someone else's
 * dependency.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dependency } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { DependencyList } from "./DependencyList.tsx";

const dep = (over: Partial<Dependency> = {}): Dependency => ({
  task_id: "UI-1",
  depends_on_task_id: "UI-2",
  dependency_type: "blocks",
  status: "active",
  rationale: "",
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

function renderList(
  dependencies: Dependency[],
  post?: () => Promise<Response>,
) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/dependencies/resolve" && init?.method === "POST") {
      calls.push({ url: path, body: JSON.parse(String(init.body)) });
      return post
        ? post()
        : new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;

  const onChanged = vi.fn();
  // A persisted identity, as the retirement tests do it: mutationsEnabled
  // needs an accountable actor, and the stub fetch has no bootstrap to adopt
  // one from.
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  render(
    <AppProvider
      store={store}
      client={new ApiClient(() => "console-1", "", fetchImpl)}
    >
      <DependencyList taskId="UI-1" dependencies={dependencies} onChanged={onChanged} />
    </AppProvider>,
  );
  return { calls, onChanged };
}

describe("DependencyList", () => {
  it("offers Mark resolved only on active rows", async () => {
    renderList([
      dep({ depends_on_task_id: "UI-2", status: "active" }),
      dep({ depends_on_task_id: "UI-3", status: "resolved" }),
    ]);
    // findBy, not getBy: the control waits on bootstrap settling, since it is
    // withheld until there is an accountable actor.
    expect(await screen.findAllByRole("button", { name: "Mark resolved" })).toHaveLength(1);
  });

  it("resolves without a confirmation step", async () => {
    // Non-destructive by ruling: the record is kept. A confirm here would
    // teach the operator that confirmations are noise.
    const user = userEvent.setup();
    const { calls, onChanged } = renderList([dep()]);
    await user.click(await screen.findByRole("button", { name: "Mark resolved" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
  });

  it("sends the exact edge: task, depends_on, type, and the actor", async () => {
    const user = userEvent.setup();
    const { calls } = renderList([
      dep({ depends_on_task_id: "UI-9", dependency_type: "informs" }),
    ]);
    await user.click(await screen.findByRole("button", { name: "Mark resolved" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toMatchObject({
      task: "UI-1",
      depends_on: "UI-9",
      type: "informs",
      actor: "local-operator",
    });
  });

  it("surfaces a refusal instead of failing silently", async () => {
    const user = userEvent.setup();
    renderList(
      [dep()],
      async () =>
        new Response(
          JSON.stringify({ ok: false, error: { code: "not_found", message: "no such edge" } }),
          { status: 404 },
        ),
    );
    await user.click(await screen.findByRole("button", { name: "Mark resolved" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no such edge");
  });

  it("keeps the resolved record visible rather than removing the row", () => {
    renderList([dep({ status: "resolved" })]);
    expect(screen.getByText("UI-2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark resolved" })).toBeNull();
  });

  it("shows the rationale when one was recorded", () => {
    renderList([dep({ rationale: "needs the schema first" })]);
    expect(screen.getByText("needs the schema first")).toBeTruthy();
  });
});
