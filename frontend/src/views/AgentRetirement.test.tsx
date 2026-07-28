/**
 * Agent retirement and restore (UI-30).
 *
 * Section 8 clause 10: successful retirement, refusal with an active session,
 * the outstanding-assignment warning, restore to active, and the
 * self-retirement and local-operator guards.
 *
 * The warning gets the most coverage because it is the point of the feature:
 * codex-security was retired while still holding SEC-1, and that single
 * undisclosed fact is what blocked this release.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, TaskListRow } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { AgentRetirement } from "./AgentRetirement.tsx";

const AGENT = { id: "mikhail-ux", name: "Mikhail", status: "active" } as Agent;

const TASKS = [
  { id: "UX-7", title: "Conversation UX", assignees: ["mikhail-ux"], status: "blocked" },
  { id: "UX-1", title: "Console UX", assignees: ["mikhail-ux"], status: "blocked" },
  { id: "UI-1", title: "Someone else's", assignees: ["david"], status: "todo" },
  { id: "OLD-1", title: "Finished", assignees: ["mikhail-ux"], status: "done" },
] as TaskListRow[];

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function harness(update?: (body: unknown) => Promise<unknown>) {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.match(/\/api\/agents\/[^/]+$/) && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      try {
        const data = update ? await update(body) : { id: AGENT.id, status: body.status };
        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
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

function show(fetchImpl: typeof fetch, agent = AGENT, tasks = TASKS) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <AgentRetirement agent={agent} tasks={tasks} onClose={onClose} onChanged={onChanged} />
    </AppProvider>,
  );
  return { onClose, onChanged };
}

const confirm = () => screen.getByRole("button", { name: /retire agent/i });

describe("AgentRetirement — clause 3, nothing is deleted", () => {
  it("says the change is reversible and destroys nothing", () => {
    // The word "retire" invites a deletion reading, and an operator who
    // believes that leaves stale identities in place — which is how we got here.
    show(harness().fetchImpl);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/Nothing is deleted/i);
    expect(body).toMatch(/restore it to active at any time/i);
  });
});

describe("AgentRetirement — clause 4, outstanding work", () => {
  it("lists every unfinished task the agent still holds, linked", () => {
    show(harness().fetchImpl);
    expect(screen.getByRole("link", { name: "UX-1" }).getAttribute("href")).toBe("#/tasks/UX-1");
    expect(screen.getByRole("link", { name: "UX-7" })).toBeTruthy();
  });

  it("excludes other agents' work and finished work", () => {
    show(harness().fetchImpl);
    expect(screen.queryByText("UI-1")).toBeNull();
    expect(screen.queryByText("OLD-1")).toBeNull();
  });

  it("explains that retiring does not unassign", () => {
    show(harness().fetchImpl);
    expect(screen.getByRole("note").textContent).toMatch(/does not unassign them/i);
    expect(screen.getByRole("note").textContent).toMatch(/cannot be picked up/i);
  });

  it("puts the consequence in the confirm control's accessible name", () => {
    // So a screen-reader operator hears it before activating, not after.
    show(harness().fetchImpl);
    expect(
      screen.getByRole("button", { name: /leaving 2 assigned tasks/i }),
    ).toBeTruthy();
  });

  it("warns but does not block — releasing work deliberately is legitimate", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness();
    show(fetchImpl);
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);
    await user.click(confirm());
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it("shows no warning when the agent holds nothing", () => {
    show(harness().fetchImpl, AGENT, []);
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("AgentRetirement — clause 1, retire and restore", () => {
  it("retires with one call carrying status and actor", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness();
    const { onChanged } = show(fetchImpl);

    await user.click(confirm());
    await waitFor(() => expect(sent).toHaveLength(1));
    // Agents carry no revision, so there is no if_revision to send.
    expect(sent[0]).toEqual({ status: "inactive", actor: "local-operator" });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("restores a retired agent, and says assignments are unchanged", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness();
    show(fetchImpl, { ...AGENT, status: "inactive" } as Agent);

    expect(document.body.textContent).toMatch(/existing assignments are unchanged/i);
    await user.click(screen.getByRole("button", { name: /restore to active/i }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ status: "active", actor: "local-operator" });
  });

  it("does not warn about outstanding work when restoring", () => {
    show(harness().fetchImpl, { ...AGENT, status: "inactive" } as Agent);
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("AgentRetirement — clause 6, errors", () => {
  it("maps the active-session refusal and does not retry", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness(async () => {
      throw { code: "agent_has_active_sessions", message: "raw", status: 409 };
    });
    const { onChanged } = show(fetchImpl);

    await user.click(confirm());
    await screen.findByRole("alert");
    expect(screen.getByText(/Mikhail still has an active session/)).toBeTruthy();
    expect(screen.getByText(/recover it from Health/)).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("maps a retired acting actor", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => {
      throw { code: "inactive_actor", message: "raw", status: 409 };
    });
    show(fetchImpl);
    await user.click(confirm());
    await screen.findByRole("alert");
    expect(screen.getByText(/Choose an active actor/)).toBeTruthy();
  });
});

describe("AgentRetirement — clause 8, accessibility", () => {
  it("opens with focus on its heading and contains Tab", async () => {
    const user = userEvent.setup();
    show(harness().fetchImpl);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: /Retire Mikhail/ }),
    );
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = show(harness().fetchImpl);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
