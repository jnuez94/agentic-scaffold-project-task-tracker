/**
 * Keyboard containment for the Broadcast dialog (UI-17).
 *
 * `aria-modal="true"` tells assistive technology the rest of the page is
 * unavailable. Until this suite existed the dialog said so while Tab walked out
 * into the navigation behind it, so an operator editing a draft could land on a
 * route link with nothing announcing that they had left.
 *
 * Driven with real Tab keystrokes rather than by calling the helper, because
 * the helper being right and the dialog being contained are different claims.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { BroadcastComposer } from "./BroadcastComposer.tsx";

function quietFetch(sendImpl?: () => Promise<Response>) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/messages") && init?.method === "POST" && sendImpl) {
      return sendImpl();
    }
    if (path.startsWith("/api/messages") && init?.method === "POST") {
      return new Response(JSON.stringify({ ok: true, data: { id: "bcast-1" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
}

function renderComposer(fetchImpl: typeof fetch, onClose = vi.fn()) {
  render(
    <>
      {/* Stands in for the shell behind the dialog. If containment fails, Tab
          lands here — which is exactly the defect. */}
      <button type="button">background nav link</button>
      <AppProvider
        store={new IdentityStore(null)}
        client={new ApiClient(() => "console-1", "", fetchImpl)}
      >
        <BroadcastComposer
          senderId="local-operator"
          senderName="Local Operator"
          sessionId="console-1"
          onClose={onClose}
          onSent={vi.fn()}
        />
      </AppProvider>
    </>,
  );
  return { onClose };
}

const inDialog = () => Boolean(document.activeElement?.closest('[role="dialog"]'));

describe("Broadcast dialog focus containment", () => {
  it("opens with focus on the dialog heading", () => {
    renderComposer(quietFetch());
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Broadcast to team" }));
  });

  it("keeps focus inside across a full forward cycle", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());

    // More presses than there are controls, so it must wrap rather than escape.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(inDialog()).toBe(true);
    }
  });

  it("keeps focus inside across a full reverse cycle", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());

    for (let i = 0; i < 12; i += 1) {
      await user.tab({ shift: true });
      expect(inDialog()).toBe(true);
    }
  });

  it("wraps from the last control back to the first", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());

    const close = screen.getByRole("button", { name: "Close broadcast composer" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    cancel.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
  });

  it("wraps from the first control back to the last", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());

    const close = screen.getByRole("button", { name: "Close broadcast composer" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    close.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(cancel);
  });

  it("never reaches the background even after many keystrokes", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());
    const background = screen.getByRole("button", { name: "background nav link" });

    for (let i = 0; i < 20; i += 1) {
      await user.tab();
      expect(document.activeElement).not.toBe(background);
    }
  });

  it("includes controls that appear after an error", async () => {
    const user = userEvent.setup();
    renderComposer(
      quietFetch(
        async () =>
          new Response(
            JSON.stringify({ ok: false, error: { code: "cli_unavailable", message: "nope" } }),
            { status: 503 },
          ),
      ),
    );

    await user.type(screen.getByLabelText("Message"), "a draft worth keeping");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await screen.findByRole("alert");

    // The banner's dismiss control joins the cycle without re-registration,
    // and containment still holds around the larger set.
    for (let i = 0; i < 14; i += 1) {
      await user.tab();
      expect(inDialog()).toBe(true);
    }
  });

  it("still contains focus once the sent receipt replaces the draft", async () => {
    const user = userEvent.setup();
    renderComposer(quietFetch());

    await user.type(screen.getByLabelText("Message"), "standup at ten");
    await user.click(screen.getByRole("button", { name: /send broadcast/i }));
    await screen.findByRole("status");

    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(inDialog()).toBe(true);
    }
  });

  it("closes on Escape with an empty draft", async () => {
    const user = userEvent.setup();
    const { onClose } = renderComposer(quietFetch());
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding a draft on Escape, and keeps it when refused", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const { onClose } = renderComposer(quietFetch());

    await user.type(screen.getByLabelText("Message"), "half-written thought");
    await user.keyboard("{Escape}");

    expect(confirmSpy).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
      "half-written thought",
    );
    confirmSpy.mockRestore();
  });

  it("discards on Escape when the operator confirms", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const { onClose } = renderComposer(quietFetch());

    await user.type(screen.getByLabelText("Message"), "half-written thought");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    confirmSpy.mockRestore();
  });
});
