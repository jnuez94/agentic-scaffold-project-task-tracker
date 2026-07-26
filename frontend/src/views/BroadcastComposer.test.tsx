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

describe("BroadcastComposer", () => {
  it("sends exactly one message addressed to the literal team recipient", async () => {
    const user = userEvent.setup();
    const { sends, fetchImpl } = harness(async () => ({ id: "bcast-1" }));
    const { onSent } = renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "standup at ten");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]).toMatchObject({
      sender: "local-operator",
      recipient: "team",
      body: "standup at ten",
    });
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("refuses a whitespace-only body without calling the API", async () => {
    const user = userEvent.setup();
    const { sends, fetchImpl } = harness(async () => ({ id: "x" }));
    renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "   ");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));

    expect(sends).toHaveLength(0);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.any(String));
  });

  it("includes optional task and tags when provided", async () => {
    const user = userEvent.setup();
    const { sends, fetchImpl } = harness(async () => ({ id: "bcast-2" }));
    renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "see UI-7");
    await user.type(screen.getByLabelText("Related task"), "UI-7");
    await user.type(screen.getByLabelText("Tags"), "status");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));

    await waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]).toMatchObject({ task: "UI-7", tags: "status" });
  });

  it("preserves the draft and never auto-retries after a failure", async () => {
    const user = userEvent.setup();
    const { sends, fetchImpl } = harness(async () => {
      throw new ApiError("database_busy", "busy", 503);
    });
    renderComposer(fetchImpl as unknown as typeof fetch);

    const body = screen.getByLabelText("Message") as HTMLTextAreaElement;
    await user.type(body, "keep me");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));

    await waitFor(() => expect(sends).toHaveLength(1));
    // Draft intact, and no second attempt was made on its own.
    expect(body.value).toBe("keep me");
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(sends).toHaveLength(1);
  });

  it("reuses the resolved id on an ordinary retry", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { sends, fetchImpl } = harness(async () => {
      attempts += 1;
      if (attempts === 1) throw new ApiError("database_busy", "busy", 503);
      return { id: "bcast-3" };
    });
    renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "retry me");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await waitFor(() => expect(sends).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await waitFor(() => expect(sends).toHaveLength(2));

    expect((sends[1] as { id: string }).id).toBe((sends[0] as { id: string }).id);
  });

  it("mints a fresh id after a duplicate-id conflict", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { sends, fetchImpl } = harness(async () => {
      attempts += 1;
      if (attempts === 1) throw new ApiError("constraint_violation", "duplicate", 409);
      return { id: "bcast-4" };
    });
    renderComposer(fetchImpl as unknown as typeof fetch);

    await user.type(screen.getByLabelText("Message"), "dup");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await waitFor(() => expect(sends).toHaveLength(1));
    // The conflict must reach the component as its real code, not be degraded.
    expect(document.querySelector(".error-code")?.textContent).toContain("constraint_violation");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await waitFor(() => expect(sends).toHaveLength(2));

    expect((sends[1] as { id: string }).id).not.toBe((sends[0] as { id: string }).id);
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
