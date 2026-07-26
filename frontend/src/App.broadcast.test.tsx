/**
 * Broadcast containment at the App boundary (UI-17).
 *
 * The composer's own suite proves Tab cannot leave the dialog. What it cannot
 * see is the shell around it: whether the background is genuinely inert, and
 * whether focus finds its way back to the launcher afterwards.
 *
 * That second one is not hypothetical. Making the background inert broke focus
 * return, because the launcher restored focus in the same tick as the close and
 * the trigger was still inert at that moment — focus went to <body> instead,
 * silently. Only a rendered check caught it, so it gets a test here.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { ApiClient } from "./api/client.ts";
import { AppProvider } from "./state/AppContext.tsx";
import { IdentityStore } from "./state/identityStore.ts";

const OPERATOR = {
  id: "local-operator",
  name: "Local Operator",
  role: "Human Operator",
  actor_type: "human",
  status: "active",
  updated_at: "2026-07-26T10:00:00+00:00",
};

const SESSION = {
  id: "console-1",
  agent_id: "local-operator",
  harness: "coordination-console",
  model: "",
  status: "active",
  started_at: "2026-07-26T09:00:00+00:00",
  last_seen_at: "2026-07-26T10:00:00+00:00",
  ended_at: null,
};

function json(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
}

function consoleFetch() {
  return vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (path.includes("/api/meta"))
      return json({ database: "/tmp/coordination.sqlite3", cli_version: "1.2.0", schema: "v1" });
    if (path.includes("/api/agents")) return json([OPERATOR]);
    if (path.includes("/api/sessions")) return json([SESSION]);
    return json([]);
  }) as unknown as typeof fetch;
}

function renderApp() {
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  return render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", consoleFetch())}>
      <App />
    </AppProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: /broadcast to team/i });

afterEach(() => {
  globalThis.location.hash = "";
});

describe("Broadcast within the app shell", () => {
  it("makes the whole background shell inert while open, not just the content", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect((trigger() as HTMLButtonElement).disabled).toBe(false));

    await user.click(trigger());
    await screen.findByRole("dialog");

    const background = document.querySelector(".shell-background");
    expect(background?.hasAttribute("inert")).toBe(true);
    // The navigation, toolbar, and footer all live inside that one boundary.
    expect(background?.querySelector(".nav")).toBeTruthy();
    expect(background?.querySelector(".topbar")).toBeTruthy();
    expect(background?.querySelector(".statusbar")).toBeTruthy();
  });

  it("returns focus to the launcher after Escape", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect((trigger() as HTMLButtonElement).disabled).toBe(false));

    await user.click(trigger());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Not <body>: the operator must resume from where they opened it.
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("returns focus to the launcher after the close button", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect((trigger() as HTMLButtonElement).disabled).toBe(false));

    await user.click(trigger());
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Close broadcast composer" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("releases the background when the dialog closes", async () => {
    const user = userEvent.setup();
    renderApp();
    await waitFor(() => expect((trigger() as HTMLButtonElement).disabled).toBe(false));

    await user.click(trigger());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(document.querySelector(".shell-background")?.hasAttribute("inert")).toBe(false),
    );
  });
});
