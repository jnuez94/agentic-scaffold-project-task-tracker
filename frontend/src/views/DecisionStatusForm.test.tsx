/**
 * Ruling on a decision from the console (UI-73): note mandatory, if_status
 * from the loaded row, status_mismatch named, the change announced with its
 * receipt.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Decision } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { DecisionStatusForm } from "./DecisionStatusForm.tsx";

const DECISION = {
  id: "DEC-1",
  title: "Adopt the ledger layout",
  owner_id: "alice",
  status: "proposed",
} as Decision;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function harness(status = 200) {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/api/decisions/DEC-1/status") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { status: string };
      sent.push(body);
      const payload =
        status === 200
          ? { ok: true, data: { id: "DEC-1", previous_status: "proposed", status: body.status }, audit_range: [1900, 1900] }
          : { ok: false, error: { code: "status_mismatch", message: "expected proposed, found accepted" } };
      return new Response(JSON.stringify(payload), { status });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function show(fetchImpl: typeof fetch) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <DecisionStatusForm decision={DECISION} onClose={onClose} onChanged={onChanged} />
    </AppProvider>,
  );
  return { onClose, onChanged };
}

describe("DecisionStatusForm", () => {
  it("will not submit without a status and a reason, and says why", async () => {
    show(harness().fetchImpl);
    const submit = await screen.findByRole<HTMLButtonElement>("button", { name: "Change status" });
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Choose the status this decision moves to.")).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText("New status"), "accepted");
    expect(screen.getByText(/Say why/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Change status" }).disabled).toBe(true);
  });

  it("marks the current status as current and unselectable", async () => {
    show(harness().fetchImpl);
    const option = await screen.findByRole<HTMLOptionElement>("option", { name: "proposed (current)" });
    expect(option.disabled).toBe(true);
  });

  it("sends the loaded status as if_status with the note, then announces and closes", async () => {
    const { sent, fetchImpl } = harness();
    const { onClose, onChanged } = show(fetchImpl);

    await userEvent.selectOptions(await screen.findByLabelText("New status"), "superseded");
    await userEvent.type(screen.getByLabelText("Why"), "Replaced by DEC-2.");
    await userEvent.click(screen.getByRole("button", { name: "Change status" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(sent[0]).toEqual({
      status: "superseded",
      actor: "local-operator",
      if_status: "proposed",
      note: "Replaced by DEC-2.",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("names the decision when it changed underneath, and keeps the draft", async () => {
    const { fetchImpl } = harness(409);
    show(fetchImpl);

    await userEvent.selectOptions(await screen.findByLabelText("New status"), "accepted");
    await userEvent.type(screen.getByLabelText("Why"), "Confirmed.");
    await userEvent.click(screen.getByRole("button", { name: "Change status" }));

    await screen.findByText("This decision changed while you were looking; reload.");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Why").value).toBe("Confirmed.");
  });
});
