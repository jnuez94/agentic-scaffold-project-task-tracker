/**
 * The escalation and evidence forms open inside an inspector; Escape closes
 * the form and leaves the inspector, and the draft's context, where it is
 * (UI-80). Before they joined the Escape stack, Escape went straight to the
 * inspector and took a half-written escalation with it.
 *
 * The outer layer mounts first and the form later, as in the console: the
 * stack orders layers by when they opened.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { useEscape } from "../state/useEscape.ts";
import { AddEvidenceForm } from "./AddEvidenceForm.tsx";
import { EscalationForm } from "./EscalationForm.tsx";

const AGENTS = [{ id: "michael-ux", name: "Michael", role: "UX", actor_type: "ai", status: "active" } as Agent];

function Inspector({ onClose, form }: { onClose: () => void; form: (close: () => void) => ReactNode }) {
  useEscape(onClose);
  const [open, setOpen] = useState(false);
  return (
    <aside aria-label="inspector">
      <button type="button" onClick={() => setOpen(true)}>
        Open form
      </button>
      {open ? form(() => setOpen(false)) : null}
    </aside>
  );
}

function show(form: (close: () => void) => ReactNode) {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }));
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const inspectorClosed = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl as typeof fetch)}>
      <Inspector onClose={inspectorClosed} form={form} />
    </AppProvider>,
  );
  return { inspectorClosed };
}

describe("Escape in a form inside an inspector", () => {
  it("closes the escalation form and not the inspector", async () => {
    const user = userEvent.setup();
    const { inspectorClosed } = show((close) => (
      <EscalationForm relatedTask="UI-12" agents={AGENTS} onClose={close} onRaised={vi.fn()} />
    ));
    await user.click(screen.getByRole("button", { name: "Open form" }));
    expect(await screen.findByLabelText("Issue")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Issue")).toBeNull();
    expect(inspectorClosed).not.toHaveBeenCalled();
  });

  it("closes the evidence form and not the inspector", async () => {
    const user = userEvent.setup();
    const { inspectorClosed } = show((close) => (
      <AddEvidenceForm taskId="UI-12" onCancel={close} onAdded={vi.fn()} />
    ));
    await user.click(screen.getByRole("button", { name: "Open form" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(inspectorClosed).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(inspectorClosed).toHaveBeenCalledTimes(1);
  });
});
