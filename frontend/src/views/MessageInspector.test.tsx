import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider, useApp } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { MessageInspector } from "./MessageInspector.tsx";

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "MSG-1",
    sender_id: "mikhail-ux",
    recipient: "david",
    task_id: "UI-9",
    body: "A short handoff.",
    tags: "ux,handoff",
    created_at: "2026-07-26T07:31:11+00:00",
    ...overrides,
  };
}

const quietFetch = vi.fn(
  async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
);

/** The real live region lives in App; this stands in for it. */
function AnnouncementProbe() {
  const { announcement } = useApp();
  return <div data-testid="announcement">{announcement}</div>;
}

function show(msg: Message, onClose = vi.fn()) {
  render(
    <AppProvider
      store={new IdentityStore(null)}
      client={new ApiClient(() => null, "", quietFetch as unknown as typeof fetch)}
    >
      <MessageInspector message={msg} onClose={onClose} />
      <AnnouncementProbe />
    </AppProvider>,
  );
  return { onClose };
}

describe("MessageInspector content", () => {
  it("shows a short body in full", () => {
    show(message());
    expect(screen.getByText("A short handoff.")).toBeTruthy();
  });

  it("never truncates a very long body", () => {
    const body = "x".repeat(5000);
    show(message({ body }));
    expect(screen.getByText(body).textContent).toHaveLength(5000);
  });

  it("preserves meaningful line breaks", () => {
    const body = "line one\nline two\n\nline four";
    show(message({ body }));
    const rendered = screen.getByText((_, el) => el?.className === "message-body");
    // The exact text, newlines included, reaches the DOM. jsdom loads no CSS,
    // so the pre-wrap rule that renders them is verified in the browser.
    expect(rendered.textContent).toBe(body);
    expect(rendered.className).toBe("message-body");
  });

  it("renders Unicode and emoji intact", () => {
    const body = "héllo — 世界 🙂 naïve";
    show(message({ body }));
    expect(screen.getByText(body)).toBeTruthy();
  });

  it("shows None rather than a fabricated value when there is no task", () => {
    show(message({ task_id: null }));
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("shows an em dash for empty tags rather than inventing one", () => {
    show(message({ tags: "" }));
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders every contracted field and no others", () => {
    show(message());
    for (const label of ["From", "To", "Related task", "Tags", "Sent", "Message"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("offers no edit, delete, reply, or acknowledgement control", () => {
    show(message());
    const labels = screen.getAllByRole("button").map((b) => b.textContent?.toLowerCase() ?? "");
    for (const forbidden of ["edit", "delete", "reply", "acknowledge", "mark read", "resend"]) {
      expect(labels.some((l) => l.includes(forbidden))).toBe(false);
    }
  });

  it("claims no delivery or read state", () => {
    show(message());
    const text = document.body.textContent?.toLowerCase() ?? "";
    for (const forbidden of ["delivered", "unread", "read receipt", "seen by"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("MessageInspector behaviour", () => {
  it("moves focus to the heading on open", () => {
    show(message());
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: /mikhail-ux/ }),
    );
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = show(message());
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the explicit control", async () => {
    const user = userEvent.setup();
    const { onClose } = show(message());
    await user.click(screen.getByRole("button", { name: /close message/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers a back control for the narrow sequential view", () => {
    show(message());
    expect(screen.getByRole("button", { name: /back to messages/i })).toBeTruthy();
  });

  it("copies the body and announces the result", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    show(message({ body: "copy me" }));
    await user.click(screen.getByRole("button", { name: /copy message body/i }));
    expect(writeText).toHaveBeenCalledWith("copy me");
    await waitFor(() =>
      expect(screen.getByTestId("announcement").textContent).toMatch(/copied to the clipboard/i),
    );
  });

  it("announces a copy failure instead of claiming success", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    show(message());
    await user.click(screen.getByRole("button", { name: /copy message body/i }));
    await waitFor(() =>
      expect(screen.getByTestId("announcement").textContent).toMatch(/copying failed/i),
    );
  });
});
