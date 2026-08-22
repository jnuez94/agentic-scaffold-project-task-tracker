/**
 * Ending your own session (UI-51).
 *
 * The ruling under test is the disable, not the happy path: `session end`
 * refuses outright while claims are held — no force flag — so the control
 * must be withheld with the reason and the task ids, never offered and
 * allowed to fail. The copy must also never read as recovery, which blocks
 * tasks and clears claims; ending touches nothing.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { EndSessionControl } from "./EndSessionControl.tsx";

const task = (id: string, claimSession: string | null) => ({
  id,
  title: id,
  description: "",
  status: "in_progress",
  priority: 2,
  tags: "",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "",
  notes: "",
  revision: 1,
  created_by: "david",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  claimed_by: claimSession ? "david" : null,
  claim_session_id: claimSession,
  claimed_at: null,
  assignees: ["david"],
  evidence_count: 0,
});

function renderControl(
  tasks: unknown[],
  endImpl?: () => Promise<Response>,
) {
  const ends: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/tasks")) {
      return new Response(JSON.stringify({ ok: true, data: tasks }), { status: 200 });
    }
    if (/\/api\/sessions\/[^/]+\/end$/.test(path) && init?.method === "POST") {
      ends.push(path);
      return endImpl
        ? endImpl()
        : new Response(JSON.stringify({ ok: true, data: { status: "ended" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;

  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onEnded = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <EndSessionControl sessionId="console-1" onEnded={onEnded} />
    </AppProvider>,
  );
  return { ends, onEnded };
}

describe("EndSessionControl", () => {
  it("ends an unclaimed session and reports the consequence", async () => {
    const user = userEvent.setup();
    const { ends, onEnded } = renderControl([task("UI-1", null)]);
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "End session" });
    await waitFor(() => expect(button.disabled).toBe(false));
    await user.click(button);
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(ends).toEqual(["/api/sessions/console-1/end"]);
  });

  it("disables End while this session holds a claim, and says why", async () => {
    renderControl([task("UI-7", "console-1"), task("UI-9", null)]);
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "End session" });
    await waitFor(() =>
      expect(screen.getByText(/holds a claim/)).toBeTruthy(),
    );
    expect(button.disabled).toBe(true);
    // Names the task and points at Release — the existing control, not a
    // third home for it.
    expect(screen.getByText("UI-7")).toBeTruthy();
    expect(screen.getByText(/Release/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /release/i })).toBeNull();
  });

  it("counts only this session's claims, not everyone's", async () => {
    renderControl([task("UI-7", "someone-else"), task("UI-9", null)]);
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "End session" });
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.queryByText(/holds a claim/)).toBeNull();
  });

  it("stays disabled until the claims are actually known", () => {
    // Unknown is treated as held: enabling before the fetch lands offers an
    // action the CLI may refuse.
    renderControl([]);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "End session" }).disabled).toBe(true);
  });

  it("names every claimed task when there are several", async () => {
    renderControl([task("UI-7", "console-1"), task("UI-9", "console-1")]);
    await waitFor(() => expect(screen.getByText(/UI-7, UI-9/)).toBeTruthy());
    expect(screen.getByText(/claims on/)).toBeTruthy();
  });

  it("surfaces a refusal instead of failing silently", async () => {
    const user = userEvent.setup();
    renderControl(
      [task("UI-1", null)],
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "session_has_active_claims", message: "claims held" },
          }),
          { status: 409 },
        ),
    );
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "End session" });
    await waitFor(() => expect(button.disabled).toBe(false));
    await user.click(button);
    expect((await screen.findByRole("alert")).textContent).toContain("claims held");
  });

  it("never uses recovery's vocabulary", async () => {
    // Ending refuses to touch claims; recovery blocks tasks and clears them.
    // The words must not blur, per the ruling this task exists for.
    renderControl([task("UI-7", "console-1")]);
    await screen.findByRole("button", { name: "End session" });
    await waitFor(() => expect(screen.getByText(/holds a claim/)).toBeTruthy());
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/recover/i);
    expect(text).not.toMatch(/blocked/i);
  });
});
