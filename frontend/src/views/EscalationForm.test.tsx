/**
 * Raising an escalation (UI-49).
 *
 * Pins the ruling: owner is active agents only, raised_by is the acting actor
 * and read-only, the prefill from Health lands in the issue, and the wire
 * shape carries the route's required fields.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { EscalationForm } from "./EscalationForm.tsx";

const AGENTS: Agent[] = [
  { id: "michael-ux", name: "Michael", role: "UX", actor_type: "ai", status: "active" } as Agent,
  { id: "mikhail-ux", name: "Mikhail", role: "UX", actor_type: "ai", status: "inactive" } as Agent,
];
const EXISTING = [{ id: "ESC-SEC1-OWNER-1" }, { id: "ESC-UI12-1" }];

function renderForm(over: { prefillIssue?: string; post?: () => Promise<Response> } = {}) {
  const sent: Record<string, unknown>[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/escalations" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      return over.post
        ? over.post()
        : new Response(JSON.stringify({ ok: true, data: { id: body["id"] } }), { status: 200 });
    }
    if (path.startsWith("/api/escalations")) {
      return new Response(JSON.stringify({ ok: true, data: EXISTING }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  // local-operator, as the other form tests do: bootstrap reconciles an actor
  // that is not in the (stubbed, empty) agent list back to the default, which
  // is the UI-14 clean-launch rule and not something to work around here.
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onRaised = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <EscalationForm
        relatedTask="UI-12"
        prefillIssue={over.prefillIssue}
        agents={AGENTS}
        onClose={vi.fn()}
        onRaised={onRaised}
      />
    </AppProvider>,
  );
  return { sent, onRaised };
}

const raise = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole<HTMLButtonElement>("button", { name: /Raise escalation/ });
  await waitFor(() => expect(button.disabled).toBe(false));
  await user.click(button);
};

describe("EscalationForm", () => {
  it("suggests an id in the board's convention, continuing an existing prefix", async () => {
    renderForm();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("ESC-UI12-2"),
    );
  });

  it("pre-fills the related task and the issue from the handoff", () => {
    renderForm({ prefillIssue: "waiting on a copy ruling" });
    expect(screen.getByLabelText<HTMLInputElement>("Related tasks").value).toBe("UI-12");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Issue").value).toBe(
      "waiting on a copy ruling",
    );
  });

  it("shows raised_by as the acting actor, read-only", async () => {
    renderForm();
    const raisedBy = screen.getByLabelText<HTMLInputElement>("Raised by");
    // Identity settles after bootstrap; the value is read once it has.
    await waitFor(() => expect(raisedBy.value).toBe("local-operator"));
    expect(raisedBy.readOnly).toBe(true);
  });

  it("offers only active agents as owners", () => {
    renderForm();
    const values = [...screen.getByLabelText<HTMLSelectElement>("Owner").options].map((o) => o.value);
    expect(values).toContain("michael-ux");
    expect(values).not.toContain("mikhail-ux");
  });

  it("refuses without an owner, on the field, and sends nothing", async () => {
    const user = userEvent.setup();
    const { sent } = renderForm({ prefillIssue: "x" });
    await user.type(screen.getByLabelText("Requested decision"), "d");
    await raise(user);
    expect(screen.getByLabelText("Owner").getAttribute("aria-invalid")).toBe("true");
    expect(sent).toHaveLength(0);
  });

  it("sends the route's required fields with raised_by as the actor", async () => {
    const user = userEvent.setup();
    const { sent, onRaised } = renderForm({ prefillIssue: "stuck on copy" });
    await user.selectOptions(screen.getByLabelText("Owner"), "michael-ux");
    await user.type(screen.getByLabelText("Requested decision"), "rule on it");
    await raise(user);
    await waitFor(() => expect(onRaised).toHaveBeenCalled());
    expect(sent[0]).toMatchObject({
      raised_by: "local-operator",
      owner: "michael-ux",
      issue: "stuck on copy",
      requested_decision: "rule on it",
      related_tasks: "UI-12",
    });
  });

  it("keeps the operator's id once they have edited it", async () => {
    const user = userEvent.setup();
    renderForm();
    const id = screen.getByLabelText<HTMLInputElement>("Id");
    await user.clear(id);
    await user.type(id, "ESC-MINE-1");
    // The existing-ids fetch resolving must not overwrite a typed id.
    await new Promise((r) => setTimeout(r, 50));
    expect(id.value).toBe("ESC-MINE-1");
  });

  it("surfaces a duplicate-id refusal from the CLI on the id field", async () => {
    const user = userEvent.setup();
    renderForm({
      prefillIssue: "x",
      post: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "constraint_violation",
              message: "Coordination constraint failed",
              details: { database_error: "UNIQUE constraint failed: escalations.id" },
            },
          }),
          { status: 409 },
        ),
    });
    await user.selectOptions(screen.getByLabelText("Owner"), "michael-ux");
    await user.type(screen.getByLabelText("Requested decision"), "d");
    await raise(user);
    expect((await screen.findByRole("alert")).textContent).toContain("already exists");
    expect(screen.getByLabelText("Id").getAttribute("aria-invalid")).toBe("true");
  });
});
