/**
 * The audit log as a loaded window (UI-62).
 *
 * One request for the newest rows; every narrowing after that — the two
 * selects and the filter box — happens over what was loaded, without another
 * request, and the table says how many rows it holds rather than how many
 * exist.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { AuditEntry } from "../api/contract.ts";
import { CLEAR_FILTER_HINT } from "../lib/copy.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { AuditView } from "./AuditView.tsx";

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 1,
  actor: "alice",
  session_id: "s-1",
  action: "create",
  object_type: "task",
  object_id: "T-1",
  detail: "",
  created_at: "2026-09-15T10:00:00+00:00",
  ...overrides,
});

// As the API delivers them: newest first.
const WINDOW = [
  entry({ id: 3, action: "claim", object_id: "T-2" }),
  entry({ id: 2, action: "create", object_type: "agent", object_id: "bob" }),
  entry({ id: 1, action: "create", object_id: "T-1" }),
];

/** Answers /api/audit with `rows`; everything the provider bootstraps gets an empty list. */
function auditFetch(rows: AuditEntry[]) {
  const auditCalls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const isAudit = url.includes("/api/audit");
    if (isAudit) auditCalls.push(url);
    return new Response(JSON.stringify({ ok: true, data: isAudit ? rows : [] }), { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, auditCalls };
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

const bodyRows = () => screen.getAllByRole("row").slice(1).map((row) => row.textContent ?? "");

describe("AuditView", () => {
  it("loads the newest window once and shows it as a table, newest first", async () => {
    const { impl, auditCalls } = auditFetch(WINDOW);
    render(wrap(impl, <AuditView filter="" />));

    await screen.findByText("T-2");
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toContain("/api/audit?limit=500");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(bodyRows().map((text) => text.includes("T-2"))).toEqual([true, false, false]);
  });

  it("offers only the object types and actions present in the loaded rows", async () => {
    const { impl } = auditFetch(WINDOW);
    render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("T-2");

    const options = (label: string) =>
      Array.from(screen.getByLabelText<HTMLSelectElement>(label).options).map((o) => o.value);
    expect(options("Object type")).toEqual(["", "agent", "task"]);
    expect(options("Action")).toEqual(["", "claim", "create"]);
  });

  it("narrows by action over the loaded rows without another request", async () => {
    const { impl, auditCalls } = auditFetch(WINDOW);
    render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("T-2");

    await userEvent.selectOptions(screen.getByLabelText("Action"), "claim");

    await waitFor(() => expect(screen.queryByText("bob")).toBeNull());
    expect(screen.getByText("T-2")).toBeTruthy();
    expect(auditCalls).toHaveLength(1);
  });

  it("applies the loaded-row filter and explains an empty result", async () => {
    const { impl } = auditFetch(WINDOW);
    const { rerender } = render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("T-2");

    rerender(wrap(impl, <AuditView filter="bob" />));
    await waitFor(() => expect(screen.queryByText("T-2")).toBeNull());
    expect(screen.getByText("bob")).toBeTruthy();

    rerender(wrap(impl, <AuditView filter="nothing-matches" />));
    await screen.findByText("No loaded entries match this filter");
    expect(screen.getByText(CLEAR_FILTER_HINT)).toBeTruthy();
  });

  it("says the window was capped when it fills the request limit", async () => {
    const full = Array.from({ length: 500 }, (_, index) =>
      entry({ id: 500 - index, object_id: `T-${500 - index}` }),
    );
    const { impl } = auditFetch(full);
    render(wrap(impl, <AuditView filter="" />));

    await screen.findByText("T-500");
    expect(screen.getByText("Showing 1–10 of the newest 500")).toBeTruthy();
    expect(screen.getByText(/Older entries are not loaded/)).toBeTruthy();
    // The shared hedge is overridden on this view and nowhere else.
    expect(screen.queryByText(/may exist/)).toBeNull();
    expect(screen.queryByText(/500\+/)).toBeNull();
  });

  it("names the narrowing within the window once a picker is set", async () => {
    const { impl } = auditFetch(WINDOW);
    render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("T-2");

    await userEvent.selectOptions(screen.getByLabelText("Action"), "claim");
    await screen.findByText("1 matching, within the newest 3");
  });

  it("carries the ruled header wording", async () => {
    const { impl } = auditFetch(WINDOW);
    render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("T-2");
    expect(
      screen.getByText(/the type and action pickers and the filter box narrow them/),
    ).toBeTruthy();
  });

  it("has an empty state that does not blame a filter when nothing was loaded", async () => {
    const { impl } = auditFetch([]);
    render(wrap(impl, <AuditView filter="" />));
    await screen.findByText("No audit entries");
  });
});
