/**
 * Operator reassignment (UI-28).
 *
 * Section 10 of ux-reassign-work-spec.md, clause 9: retired removal,
 * claim-owner refusal, last-assignee warning, stale revision with the draft
 * preserved, and the combined add-and-remove call.
 *
 * The cases use a SEC-1-shaped task deliberately — two assignees whose display
 * name is "Toby", one active and one retired — because that is the real record
 * this feature exists to let an operator repair.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent, TaskDetail } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { AssigneeEditor } from "./AssigneeEditor.tsx";

const AGENTS = [
  { id: "toby", name: "Toby", status: "active" },
  { id: "codex-security", name: "Toby", status: "inactive" },
  { id: "david", name: "David", status: "active" },
  { id: "mikhail-ux", name: "Mikhail", status: "inactive" },
] as Agent[];

function task(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "SEC-1",
    title: "Repository-wide security review",
    status: "todo",
    assignees: ["toby", "codex-security"],
    claimed_by: null,
    claim_session_id: null,
    revision: 10,
    ...overrides,
  } as TaskDetail;
}

function harness(assign?: (body: unknown) => Promise<unknown>) {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/assign") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      try {
        const data = assign ? await assign(body) : { revision: 11, assignees: ["toby"] };
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
    // The session must exist, or useOperatorSession correctly rejects the
    // persisted id as missing and the footer reports no session.
    if (path.startsWith("/api/sessions")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: [
            {
              id: "console-1",
              agent_id: "local-operator",
              harness: "coordination-console",
              model: "",
              status: "active",
              started_at: "2026-07-27T09:00:00+00:00",
              last_seen_at: "2026-07-27T09:00:00+00:00",
              ended_at: null,
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

/** IdentityStore(null) discards writes, so back it with real in-memory storage. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function show(fetchImpl: typeof fetch, detail = task()) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <AssigneeEditor task={detail} agents={AGENTS} onClose={onClose} onSaved={onSaved} />
    </AppProvider>,
  );
  return { onClose, onSaved };
}

const save = () => screen.getByRole("button", { name: /save assignees/i });
const removeButtons = () => screen.getAllByRole("button", { name: /^Remove$/ });

describe("AssigneeEditor — clause 1, removing a retired assignee", () => {
  it("distinguishes two assignees sharing a display name by id", () => {
    // The whole reason UI-21's label treatment is reused here.
    show(harness().fetchImpl);
    expect(screen.getByText(/Toby · toby/)).toBeTruthy();
    expect(screen.getByText(/Toby · codex-security — retired/)).toBeTruthy();
  });

  it("removes the retired assignee in one call carrying the revision", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness();
    show(fetchImpl);

    // The second row is codex-security, the retired one.
    await user.click(removeButtons()[1]!);
    await user.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      actor: "local-operator",
      if_revision: 10,
      remove: ["codex-security"],
    });
  });
});

describe("AssigneeEditor — clause 2, retired agents cannot be added", () => {
  it("offers retired agents only as disabled options", () => {
    show(harness().fetchImpl);
    const retired = screen.getByRole("option", { name: /Mikhail · mikhail-ux — retired/ });
    expect((retired as HTMLOptionElement).disabled).toBe(true);
  });

  it("does not offer agents who are already assigned", () => {
    // This is what makes the CLI's add-and-remove-the-same-actor refusal
    // unreachable rather than an error the operator has to read.
    show(harness().fetchImpl);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.filter((t) => t?.includes("· toby"))).toHaveLength(0);
  });
});

describe("AssigneeEditor — clause 3, the claim owner", () => {
  it("disables Remove for the active claim owner with a stated reason", () => {
    show(harness().fetchImpl, task({ claimed_by: "toby", claim_session_id: "s1" }));
    const buttons = screen.getAllByRole("button", { name: /^Remove$/ });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/toby holds the active claim on this task/)).toBeTruthy();
  });

  it("states the reason as text rather than only a tooltip", () => {
    show(harness().fetchImpl, task({ claimed_by: "toby" }));
    const reason = screen.getByText(/Releasing or recovering the claim comes first/);
    // Accessible text: hover must not be the only way to reveal it.
    expect(reason.tagName).toBe("P");
  });
});

describe("AssigneeEditor — clause 4, the unowned warning", () => {
  it("warns when the change would leave the task unowned, and still allows it", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness(async () => ({ revision: 11, assignees: [] }));
    show(fetchImpl);

    for (const button of removeButtons()) await user.click(button);
    expect(screen.getByRole("note").textContent).toMatch(/leave the task unowned/i);
    expect(screen.getByRole("note").textContent).toMatch(/Unowned tasks on Health/i);

    // Deliberately unassigning is legitimate; it is not blocked.
    expect((save() as HTMLButtonElement).disabled).toBe(false);
    await user.click(save());
    await waitFor(() => expect(sent).toHaveLength(1));
  });

  it("does not warn when someone is added back in the same call", async () => {
    const user = userEvent.setup();
    show(harness().fetchImpl);
    for (const button of removeButtons()) await user.click(button);
    await user.selectOptions(screen.getByLabelText(/add someone/i), "david");
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("AssigneeEditor — clause 5, one call", () => {
  it("commits an add and a remove together, never as two calls", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness();
    show(fetchImpl);

    await user.click(removeButtons()[1]!);
    await user.selectOptions(screen.getByLabelText(/add someone/i), "david");
    await user.click(save());

    await waitFor(() => expect(sent).toHaveLength(1));
    // A remove that succeeded beside an add that failed would leave a state
    // the operator never asked for.
    expect(sent[0]).toEqual({
      actor: "local-operator",
      if_revision: 10,
      add: ["david"],
      remove: ["codex-security"],
    });
  });

  it("keeps Save disabled until something is pending", () => {
    show(harness().fetchImpl);
    expect((save() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("AssigneeEditor — clause 6, errors", () => {
  it("preserves the draft and offers Reload latest on a stale revision", async () => {
    const user = userEvent.setup();
    const { sent, fetchImpl } = harness(async () => {
      throw { code: "stale_task_revision", message: "Task SEC-1 changed after revision 10", status: 409 };
    });
    const { onSaved } = show(fetchImpl);

    await user.click(removeButtons()[1]!);
    await user.click(save());

    await screen.findByRole("alert");
    expect(screen.getByText(/This task changed while you were editing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /reload latest/i })).toBeTruthy();
    // Draft survives, and nothing was retried.
    expect(screen.getByRole("button", { name: /undo remove/i })).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("maps the claim-owner refusal to its copy, naming the agent", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => {
      throw { code: "task_claim_owner_mismatch", message: "raw", status: 409 };
    });
    show(fetchImpl, task({ claimed_by: "david" }));

    await user.click(removeButtons()[0]!);
    await user.click(save());

    await screen.findByRole("alert");
    expect(screen.getByText(/david holds the active claim and cannot be removed/)).toBeTruthy();
  });
});

describe("AssigneeEditor — clause 7, attribution", () => {
  it("names the actor, the session, and the revision being submitted", async () => {
    show(harness().fetchImpl);
    await screen.findByText(/console-1/);
    const footer = document.querySelector(".attribution")?.textContent ?? "";
    expect(footer).toContain("local-operator");
    expect(footer).toContain("console-1");
    expect(footer).toContain("10");
  });
});

describe("AssigneeEditor — clause 8, accessibility", () => {
  it("moves focus to its heading on open", () => {
    show(harness().fetchImpl);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Change assignees" }),
    );
  });

  it("closes on Escape when nothing is pending", async () => {
    const user = userEvent.setup();
    const { onClose } = show(harness().fetchImpl);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("confirms before discarding a pending change", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const { onClose } = show(harness().fetchImpl);

    await user.click(removeButtons()[1]!);
    await user.keyboard("{Escape}");

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
