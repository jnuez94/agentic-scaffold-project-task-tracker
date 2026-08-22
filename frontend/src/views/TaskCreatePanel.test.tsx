/**
 * Filing a task (UI-48).
 *
 * The ruling under test: field order and disclosure; id pre-filled with the
 * next free number and overridable; the duplicate-id refusal keeps the draft
 * and offers the next free number rather than only reporting the clash.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { TaskCreatePanel } from "./TaskCreatePanel.tsx";

const AGENTS: Agent[] = [
  { id: "david", name: "David", role: "FE", actor_type: "ai", status: "active" } as Agent,
  { id: "old-toby", name: "Toby", role: "Sec", actor_type: "ai", status: "inactive" } as Agent,
];
const IDS = ["UI-1", "UI-60", "UX-24"];

function renderPanel(post?: (body: Record<string, unknown>) => Promise<Response>) {
  const sent: Record<string, unknown>[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === "/api/tasks" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      return post
        ? post(body)
        : new Response(JSON.stringify({ ok: true, data: { id: body["id"] } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <TaskCreatePanel existingIds={IDS} agents={AGENTS} onClose={onClose} onCreated={onCreated} />
    </AppProvider>,
  );
  return { sent, onCreated, onClose };
}

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole<HTMLButtonElement>("button", { name: /File task/ });
  await waitFor(() => expect(button.disabled).toBe(false));
  await user.click(button);
};

describe("TaskCreatePanel", () => {
  it("pre-fills the id with the next free number of the most-used prefix", () => {
    renderPanel();
    expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("UI-61");
  });

  it("shows id, title, assignee and description; keeps the rest behind Details", () => {
    renderPanel();
    for (const label of ["Id", "Title", "Assignee", "Description"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    const details = document.querySelector<HTMLDetailsElement>("details.optional-fields");
    expect(details?.open).toBe(false);
    expect(screen.getByLabelText("Acceptance criteria")).toBeTruthy();
  });

  it("puts id first, because it is the only field with no correction path", () => {
    renderPanel();
    const controls = [...document.querySelectorAll("form input, form select, form textarea")];
    const firstTyped = controls.find((el) => (el as HTMLElement).getAttribute("aria-label") !== "Id prefix");
    expect(firstTyped?.id).toBe("create-id");
  });

  it("rewrites the id when a different prefix is chosen, and stays overridable", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.selectOptions(screen.getByLabelText("Id prefix"), "UX");
    expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("UX-25");
    await user.clear(screen.getByLabelText("Id"));
    await user.type(screen.getByLabelText("Id"), "DOC-3");
    expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("DOC-3");
  });

  it("offers only active agents as assignees", () => {
    renderPanel();
    const options = [...screen.getByLabelText<HTMLSelectElement>("Assignee").options].map(
      (option) => option.value,
    );
    expect(options).toContain("david");
    expect(options).not.toContain("old-toby");
  });

  it("refuses an empty title on the field, and sends nothing", async () => {
    const user = userEvent.setup();
    const { sent } = renderPanel();
    await submit(user);
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("title");
    expect(sent).toHaveLength(0);
  });

  it("refuses a duplicate id before sending and offers the next free number", async () => {
    const user = userEvent.setup();
    const { sent } = renderPanel();
    await user.clear(screen.getByLabelText("Id"));
    await user.type(screen.getByLabelText("Id"), "UI-60");
    await user.type(screen.getByLabelText("Title"), "t");
    await submit(user);
    expect(screen.getByRole("alert").textContent).toBe("UI-60 already exists. Next free is UI-61.");
    expect(sent).toHaveLength(0);
    // The draft survives the refusal.
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("t");
  });

  it("sends the draft with the actor and reports the new id", async () => {
    const user = userEvent.setup();
    const { sent, onCreated } = renderPanel();
    await user.type(screen.getByLabelText("Title"), "Ship it");
    await user.selectOptions(screen.getByLabelText("Assignee"), "david");
    await user.type(screen.getByLabelText("Description"), "why");
    await submit(user);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("UI-61"));
    expect(sent[0]).toMatchObject({
      id: "UI-61",
      title: "Ship it",
      actor: "local-operator",
      description: "why",
      assignees: ["david"],
      priority: 3,
    });
  });

  it("keeps the draft and offers the next free number when the CLI refuses a duplicate", async () => {
    // The loaded window can be stale; the CLI is the authority on uniqueness.
    const user = userEvent.setup();
    const { onCreated } = renderPanel(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "constraint_violation",
              message: "Coordination constraint failed",
              details: { database_error: "UNIQUE constraint failed: tasks.id" },
            },
          }),
          { status: 409 },
        ),
    );
    await user.type(screen.getByLabelText("Title"), "kept");
    await submit(user);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "UI-61 already exists. Next free is UI-62.",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("kept");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
