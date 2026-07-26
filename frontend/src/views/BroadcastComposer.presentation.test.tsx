import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiClient } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { BroadcastComposer } from "./BroadcastComposer.tsx";

/** A client whose message-send behaviour each test controls. */
function harness(sendImpl: (body: unknown) => Promise<unknown>) {
  const sends: unknown[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/messages") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      sends.push(body);
      try {
        const data = await sendImpl(body);
        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
      } catch (error) {
        const api = error as ApiError;
        return new Response(
          JSON.stringify({ ok: false, error: { code: api.code, message: api.message } }),
          { status: api.status || 500 },
        );
      }
    }
    // Bootstrap reads: an already-registered operator with an active session.
    if (path.startsWith("/api/agents")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: [
            { id: "local-operator", name: "Local Operator", role: "Human Operator",
              actor_type: "human", status: "active" },
          ],
        }),
        { status: 200 },
      );
    }
    if (path.startsWith("/api/sessions")) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: [{ id: "console-1", agent_id: "local-operator", harness: "coordination-console",
                   status: "active", last_seen_at: "2026-07-26T00:00:00+00:00" }],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sends, fetchImpl };
}

function renderComposer(fetchImpl: typeof fetch, onSent = vi.fn(), onClose = vi.fn()) {
  // Must be the ESM import: require() would load a second module instance and
  // break `instanceof ApiError`, silently degrading every error to network_error.
  const store = new IdentityStore(null);
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <BroadcastComposer
        senderId="local-operator"
        senderName="Local Operator"
        sessionId="console-1"
        onClose={onClose}
        onSent={onSent}
      />
    </AppProvider>,
  );
  return { onSent, onClose };
}

describe("BroadcastComposer presentation", () => {
  it("clears the draft and shows the id only after confirmation", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = harness(async () => ({ id: "bcast-5" }));
    renderComposer(fetchImpl as unknown as typeof fetch);

    const body = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(body, "done");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));

    expect(await screen.findByText("bcast-5")).toBeTruthy();
    expect(body.value).toBe("");
  });

  it("states no delivery, read, or audience claim", () => {
    const { fetchImpl } = harness(async () => ({ id: "x" }));
    renderComposer(fetchImpl as unknown as typeof fetch);
    const text = document.body.textContent?.toLowerCase() ?? "";
    for (const forbidden of ["delivered", "read receipt", "unread", "recipients notified", "acknowledg"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).toContain("appear when recipients check their inbox");
  });

  it("marks sender and recipient read-only", () => {
    const { fetchImpl } = harness(async () => ({ id: "x" }));
    renderComposer(fetchImpl as unknown as typeof fetch);
    expect((screen.getByLabelText("From") as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText("To") as HTMLInputElement).readOnly).toBe(true);
  });

  it("moves focus to the composer heading on open", async () => {
    const { fetchImpl } = harness(async () => ({ id: "x" }));
    renderComposer(fetchImpl as unknown as typeof fetch);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: /broadcast to team/i })),
    );
  });

  it("prevents a duplicate submit while a send is pending", async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { sends, fetchImpl } = harness(async () => {
      await gate;
      return { id: "bcast-pending" };
    });
    renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "slow send");
    const send = screen.getByRole("button", { name: /send broadcast/i });
    await user.click(send);

    // While in flight the control is disabled and further clicks do nothing.
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(true));
    await user.click(send);
    await user.click(send);
    expect(sends).toHaveLength(1);

    release(null);
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    expect(sends).toHaveLength(1);
  });
});
