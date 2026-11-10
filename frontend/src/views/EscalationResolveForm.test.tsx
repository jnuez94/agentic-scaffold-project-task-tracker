/**
 * Answering an escalation from its inspector (UI-82): offered only while it
 * waits on an answer, with the question shown beside the answer, the loaded
 * status sent as if_status, and every refusal keeping the draft.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Escalation } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider, useApp } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { RecordsView } from "./RecordsView.tsx";

const escalation = (over: Partial<Escalation> = {}): Escalation => ({
  id: "ESC-1",
  raised_by: "david",
  owner: "michael-ux",
  status: "open",
  related_tasks: "UI-1",
  needed_by: null,
  issue: "Which copy ships?",
  requested_decision: "Rule on the wording.",
  resolution: "",
  follow_up_tasks: "",
  created_at: "2026-10-01T00:00:00+00:00",
  updated_at: "2026-10-01T00:00:00+00:00",
  ...over,
});

function show(row: Escalation, reply: () => Response = () => receipt({ id: row.id, status: "resolved" })) {
  const sent: Record<string, unknown>[] = [];
  let current = row;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/resolve")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      const response = reply();
      // The refresh after a resolve returns the answered row, as the CLI would.
      if (response.ok) current = { ...row, status: body["status"] as Escalation["status"], resolution: String(body["resolution"]) };
      return response;
    }
    if (url.includes("/api/escalations")) return ok([current]);
    // One task lies beyond the loaded page, as on a board past 500 tasks.
    const lookup = /\/api\/tasks\/([^/?]+)/.exec(url);
    if (lookup) {
      return ["UI-1", "UI-2", "UI-700"].includes(lookup[1]!)
        ? ok({ id: lookup[1] })
        : new Response(JSON.stringify({ ok: false, error: { code: "not_found", message: "no such task" } }), { status: 404 });
    }
    if (url.includes("/api/tasks")) return ok([{ id: "UI-1" }, { id: "UI-2" }]);
    return ok([]);
  });
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl as typeof fetch)}>
      <RecordsView key="escalations" route="escalations" filter="" detail={row.id} onDetail={() => {}} />
      <Announced />
    </AppProvider>,
  );
  return { sent, user: userEvent.setup() };
}

/** What the console would announce, read from the context the forms write to. */
function Announced() {
  return <p data-testid="announced">{useApp().announcement}</p>;
}

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const receipt = (data: unknown) => new Response(JSON.stringify({ ok: true, data, audit_range: [42, 42] }), { status: 200 });

async function openSheet(row = escalation()) {
  const harness = show(row);
  const panel = await screen.findByRole("complementary", { name: /escalation ESC-1/ });
  await harness.user.click(within(panel).getByRole("button", { name: "Resolve…" }));
  return { ...harness, dialog: await screen.findByRole("dialog", { name: "Resolve · ESC-1" }) };
}

describe("Resolve on the escalation inspector", () => {
  it.each(["resolved", "closed_no_action"] as const)("is not offered once the escalation is %s", async (status) => {
    show(escalation({ status }));
    const panel = await screen.findByRole("complementary", { name: /escalation ESC-1/ });
    expect(within(panel).queryByRole("button", { name: "Resolve…" })).toBeNull();
  });

  it("shows the question beside the answer, and needs a resolution before sending", async () => {
    const { dialog, user } = await openSheet();
    expect(within(dialog).getByText("Which copy ships?")).toBeTruthy();
    expect(within(dialog).getByText("Rule on the wording.")).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Resolve" }).disabled).toBe(true);
    await user.type(within(dialog).getByLabelText("Resolution"), "Michael's wording ships.");
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Resolve" }).disabled).toBe(false);
  });

  it("names the owner when the actor is someone else, without blocking", async () => {
    const { dialog } = await openSheet();
    expect(within(dialog).getByText(/You are not this escalation's owner \(michael-ux\)/)).toBeTruthy();
  });

  it("refuses follow-ups that are not tasks on this board before sending", async () => {
    const { dialog, user, sent } = await openSheet();
    await user.type(within(dialog).getByLabelText("Resolution"), "Done.");
    await user.type(within(dialog).getByLabelText(/Follow-up tasks/), "UI-1 UI-9");
    expect(await within(dialog).findByText("UI-9 is not a task on this board.")).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it("looks up an id named like an object property, and refuses it when it is not a task", async () => {
    const { dialog, user } = await openSheet();
    await user.type(within(dialog).getByLabelText("Resolution"), "Done.");
    await user.type(within(dialog).getByLabelText(/Follow-up tasks/), "constructor");
    expect(await within(dialog).findByText("constructor is not a task on this board.")).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Resolve" }).disabled).toBe(true);
  });

  it("accepts a follow-up that is a task but not on the loaded page", async () => {
    const { dialog, user } = await openSheet();
    await user.type(within(dialog).getByLabelText("Resolution"), "Done.");
    await user.type(within(dialog).getByLabelText(/Follow-up tasks/), "UI-700");
    await waitFor(() =>
      expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Resolve" }).disabled).toBe(false),
    );
    expect(within(dialog).queryByText(/is not a task/)).toBeNull();
  });

  it("sends the outcome, resolution, follow-ups and the loaded status, then closes", async () => {
    const { dialog, user, sent } = await openSheet();
    await user.click(within(dialog).getByLabelText("Closed, no action"));
    await user.type(within(dialog).getByLabelText("Resolution"), "Moot after UI-79.");
    await user.type(within(dialog).getByLabelText(/Follow-up tasks/), "UI-2");
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent[0]).toEqual({
      actor: "local-operator",
      status: "closed_no_action",
      resolution: "Moot after UI-79.",
      if_status: "open",
      follow_up_tasks: "UI-2",
    });
    expect(screen.getByTestId("announced").textContent).toBe("ESC-1 closed with no action. Recorded as audit 42.");
  });

  it("keeps the draft and says why when the escalation was answered elsewhere", async () => {
    const mismatch = () =>
      new Response(JSON.stringify({ ok: false, error: { code: "status_mismatch", message: "x" } }), { status: 409 });
    const harness = show(escalation(), mismatch);
    const panel = await screen.findByRole("complementary", { name: /escalation ESC-1/ });
    await harness.user.click(within(panel).getByRole("button", { name: "Resolve…" }));
    const dialog = await screen.findByRole("dialog");
    await harness.user.type(within(dialog).getByLabelText("Resolution"), "Done.");
    await harness.user.click(within(dialog).getByRole("button", { name: "Resolve" }));

    await within(dialog).findByText(
      "This escalation changed while you were looking. Reload latest; your draft will be preserved.",
    );
    expect(within(dialog).getByLabelText<HTMLTextAreaElement>("Resolution").value).toBe("Done.");
  });

  it("follows the refreshed row, and lands on its title once Resolve… has gone", async () => {
    const { dialog, user } = await openSheet();
    await user.type(within(dialog).getByLabelText("Resolution"), "Michael's wording ships.");
    await user.click(within(dialog).getByRole("button", { name: "Resolve" }));

    const panel = screen.getByRole("complementary", { name: /escalation ESC-1/ });
    await within(panel).findByText("Michael's wording ships.");
    expect(within(panel).queryByRole("button", { name: "Resolve…" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(panel).getByRole("heading", { level: 2 })));
  });

  it("shows the owner the escalation names, which is free text", async () => {
    show(escalation({ owner: "the product council" }));
    const panel = await screen.findByRole("complementary", { name: /escalation ESC-1/ });
    expect(within(panel).getByText("the product council")).toBeTruthy();
  });

  it("returns focus to Resolve… when the sheet closes", async () => {
    const { user } = await openSheet();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Resolve…" })));
  });
});
