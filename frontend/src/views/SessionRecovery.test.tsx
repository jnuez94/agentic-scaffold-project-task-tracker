/**
 * Stale-session recovery (UI-22).
 *
 * Recovery blocks every task a session holds and ends the session. The console
 * cannot tell an abandoned session from a long-running idle one, so these tests
 * are mostly about what the operator is told before they can act, not just that
 * the request goes out.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Session, TaskListRow } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { SessionRecovery } from "./SessionRecovery.tsx";

const TWO_HOURS_AGO = new Date(Date.now() - 7200 * 1000).toISOString();

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "console-abandoned",
    agent_id: "mikhail-ux",
    harness: "coordination-console",
    model: "",
    status: "active",
    started_at: TWO_HOURS_AGO,
    last_seen_at: TWO_HOURS_AGO,
    ended_at: null,
    ...overrides,
  };
}

const claimed = [
  { id: "UI-9", title: "Add read-only inspector", claim_session_id: "console-abandoned" },
  { id: "UI-4", title: "Register local operator", claim_session_id: "console-abandoned" },
  { id: "UI-7", title: "Someone else's work", claim_session_id: "another-session" },
] as TaskListRow[];

function harness(recover: (body: unknown) => Promise<unknown>) {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/recover") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      try {
        return new Response(JSON.stringify({ ok: true, data: await recover(body) }), {
          status: 200,
        });
      } catch (error) {
        const api = error as { code?: string; message?: string; status?: number };
        return new Response(
          JSON.stringify({
            ok: false,
            error: { code: api.code ?? "internal_error", message: api.message ?? "failed" },
          }),
          { status: api.status ?? 500 },
        );
      }
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function show(
  fetchImpl: typeof fetch,
  options: { actorId?: string | null; target?: Session; tasks?: TaskListRow[] } = {},
) {
  const onClose = vi.fn();
  const onRecovered = vi.fn();
  render(
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => "s1", "", fetchImpl)}>
      <SessionRecovery
        session={options.target ?? session()}
        tasks={options.tasks ?? claimed}
        actorId={options.actorId === undefined ? "local-operator" : options.actorId}
        onClose={onClose}
        onRecovered={onRecovered}
      />
    </AppProvider>,
  );
  return { onClose, onRecovered };
}

const submitButton = () => screen.getByRole("button", { name: /recover session/i });

describe("SessionRecovery — what the operator is told", () => {
  it("states how long ago the session was seen", () => {
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    // Split across elements by the absolute-time span, so match the region.
    expect(document.body.textContent).toMatch(/last seen 2 hours ago/i);
  });

  it("says that being stale does not prove the session was abandoned", () => {
    // The whole risk of this feature in one sentence.
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    expect(screen.getByRole("note").textContent).toMatch(/does not mean it was abandoned/i);
    expect(screen.getByRole("note").textContent).toMatch(/still in use/i);
  });

  it("names the specific tasks recovery will block, and no others", () => {
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    expect(screen.getByText("UI-9")).toBeTruthy();
    expect(screen.getByText("UI-4")).toBeTruthy();
    // Held by a different session; blocking it would be a lie.
    expect(screen.queryByText("UI-7")).toBeNull();
  });

  it("spells out the consequences rather than asking if you are sure", () => {
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/blocked/i);
    expect(body).toMatch(/revision/i);
    expect(body).toMatch(/notes/i);
    expect(body).not.toMatch(/are you sure/i);
  });

  it("says plainly when there is nothing to block", () => {
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl, { tasks: [] });
    expect(screen.getByText(/holds no claimed tasks/i)).toBeTruthy();
  });
});

describe("SessionRecovery — gating", () => {
  it("will not submit without a reason", () => {
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("will not submit without an accountable actor", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl, { actorId: null });
    await user.type(screen.getByLabelText(/reason/i), "abandoned overnight");
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/select an actor/i)).toBeTruthy();
  });

  it("will not accept whitespace as a reason", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    await user.type(screen.getByLabelText(/reason/i), "   ");
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables once actor and reason are both present", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({}));
    show(fetchImpl);
    await user.type(screen.getByLabelText(/reason/i), "abandoned overnight");
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("SessionRecovery — outcomes", () => {
  it("sends the actor and trimmed reason, then reports what was blocked", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness(async () => ({
      id: "console-abandoned",
      previous_status: "active",
      status: "ended",
      recovered_tasks: [
        { id: "UI-4", status: "blocked", revision: 5 },
        { id: "UI-9", status: "blocked", revision: 8 },
      ],
    }));
    const { onRecovered } = show(fetchImpl);

    await user.type(screen.getByLabelText(/reason/i), "  laptop closed overnight  ");
    await user.click(submitButton());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ actor: "local-operator", reason: "laptop closed overnight" });

    await screen.findByRole("status");
    expect(screen.getByText(/2 tasks blocked/i)).toBeTruthy();
    expect(screen.getByText(/revision 5/)).toBeTruthy();
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it("reports an empty recovery honestly rather than claiming work was blocked", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({ id: "x", status: "ended", recovered_tasks: [] }));
    show(fetchImpl, { tasks: [] });

    await user.type(screen.getByLabelText(/reason/i), "no longer needed");
    await user.click(submitButton());

    await screen.findByRole("status");
    expect(screen.getByText(/held no claimed tasks, so nothing was blocked/i)).toBeTruthy();
  });

  it("keeps the reason and does not retry when the request fails", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness(async () => {
      throw { code: "session_not_stale", message: "not stale", status: 409 };
    });
    const { onRecovered } = show(fetchImpl);

    await user.type(screen.getByLabelText(/reason/i), "worth keeping");
    await user.click(submitButton());

    await screen.findByRole("alert");
    expect((screen.getByLabelText(/reason/i) as HTMLTextAreaElement).value).toBe("worth keeping");
    expect(sent).toHaveLength(1);
    expect(onRecovered).not.toHaveBeenCalled();
  });

  it("contains focus and closes on Escape", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({}));
    const { onClose } = show(fetchImpl);

    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Recover session" }));
    for (let i = 0; i < 10; i += 1) {
      await user.tab();
      expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    }
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
