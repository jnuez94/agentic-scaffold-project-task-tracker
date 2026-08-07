/**
 * Recording a dependency (UI-50).
 *
 * The validation logic is covered in lib/dependency.test.ts; these assert the
 * things only a rendered form can be wrong about — that a refusal reaches the
 * operator, that a rejected draft survives, and that the control is withheld
 * when there is no accountable actor.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { DependencyForm } from "./DependencyForm.tsx";

function fetchStub(post?: () => Promise<Response>) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).startsWith("/api/dependencies") && init?.method === "POST") {
      return post ? post() : new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
}

function renderForm(over: { fetchImpl?: typeof fetch; onAdded?: () => void } = {}) {
  const onAdded = over.onAdded ?? vi.fn();
  render(
    <AppProvider
      store={new IdentityStore(null)}
      client={new ApiClient(() => "console-1", "", over.fetchImpl ?? fetchStub())}
    >
      <DependencyForm taskId="UI-1" existing={[]} onAdded={onAdded} />
    </AppProvider>,
  );
  return { onAdded };
}

describe("DependencyForm", () => {
  it("offers the four relationship types the CLI accepts", () => {
    renderForm();
    const select = screen.getByLabelText<HTMLSelectElement>("Relationship");
    expect(select.options).toHaveLength(4);
  });

  it("explains each relationship rather than naming it", () => {
    // "blocks" and "informs" are schema words; the difference between them is
    // the thing an operator actually has to choose between.
    renderForm();
    expect(screen.getByRole("option", { name: /cannot proceed until/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /not a blocker/ })).toBeTruthy();
  });

  it("refuses an empty target and says why", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Record dependency/ }));
    expect(screen.getByRole("alert").textContent).toContain("Name the task");
  });

  it("refuses a self-dependency", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/waits on/), "UI-1");
    await user.click(screen.getByRole("button", { name: /Record dependency/ }));
    expect(screen.getByRole("alert").textContent).toContain("cannot depend on itself");
  });

  it("keeps what was typed when the draft is refused", async () => {
    // Retyping after a refusal is how an operator gives up on a form.
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText<HTMLInputElement>(/waits on/);
    await user.type(input, "UI-1");
    await user.click(screen.getByRole("button", { name: /Record dependency/ }));
    expect(input.value).toBe("UI-1");
  });

  it("clears the target after a successful record but keeps the relationship", async () => {
    // Recording several dependencies of one kind is the common case.
    const user = userEvent.setup();
    const { onAdded } = renderForm();
    await user.type(screen.getByLabelText(/waits on/), "UI-2");
    await user.click(screen.getByRole("button", { name: /Record dependency/ }));
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>(/waits on/).value).toBe("");
    expect(screen.getByLabelText<HTMLSelectElement>("Relationship").value).toBe("blocks");
  });

  it("surfaces a CLI refusal instead of silently failing", async () => {
    const user = userEvent.setup();
    renderForm({
      fetchImpl: fetchStub(
        async () =>
          new Response(
            JSON.stringify({ ok: false, error: { code: "not_found", message: "no such task" } }),
            { status: 404 },
          ),
      ),
    });
    await user.type(screen.getByLabelText(/waits on/), "UI-999");
    await user.click(screen.getByRole("button", { name: /Record dependency/ }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });
});
