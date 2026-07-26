/**
 * The cross-route stale-render defect (UI-15, work package 1).
 *
 * Every generic entity shares one component position, and useResource keeps the
 * previous rows while the next request is in flight. That is correct for
 * refreshing the same resource and wrong across a route change: Decision rows
 * reached the Artifacts columns, which read a field decisions do not have, and
 * the console unmounted.
 *
 * These tests exercise the transition itself — the render between "route
 * changed" and "new data arrived" — because that window is the whole bug and
 * the only place it is visible.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { RecordsView } from "./RecordsView.tsx";

const DECISION = {
  id: "DEC-1",
  title: "Adopt the CLI bridge",
  status: "accepted",
  owner_id: "david",
  decided_at: "2026-07-26T10:00:00+00:00",
  updated_at: "2026-07-26T10:00:00+00:00",
  // Deliberately absent: related_tasks. That is the field the Artifacts
  // columns join, and its absence is what threw.
};

const ARTIFACT = {
  id: "ART-1",
  type: "document",
  status: "draft",
  uri: "docs/plan.md",
  owner_id: "david",
  related_tasks: ["UI-15"],
  updated_at: "2026-07-26T10:00:00+00:00",
};

function ok(rows: unknown[]): Response {
  return new Response(JSON.stringify({ ok: true, data: rows }), { status: 200 });
}

/**
 * A fetch whose per-endpoint behaviour the test controls, including "never
 * answers" — the state the transition bug lives in.
 */
function routedFetch(routes: Record<string, () => Promise<Response>>) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const match = Object.keys(routes).find((path) => url.includes(path));
    return match ? routes[match]!() : ok([]);
  });
  return { impl: impl as unknown as typeof fetch, calls, spy: impl };
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

describe("RecordsView across a route change", () => {
  it("never renders a previous entity's rows through the new entity's columns", async () => {
    // Artifacts never answers, so the only rows available during the
    // transition are the Decision rows already on screen.
    const { impl } = routedFetch({
      "/api/decisions": async () => ok([DECISION]),
      "/api/artifacts": () => new Promise<Response>(() => {}),
    });

    const { rerender } = render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" />),
    );
    await screen.findByText("DEC-1");

    rerender(wrap(impl, <RecordsView key="artifacts" route="artifacts" filter="" />));

    expect(screen.getByRole("heading", { name: "Artifacts" })).toBeTruthy();
    // Before the route key, DEC-1 was still on screen at this point, being fed
    // to a column that called .join on a field decisions do not carry.
    await waitFor(() => expect(screen.queryByText("DEC-1")).toBeNull());
  });

  it("does not throw when a row lacks the column's expected list field", async () => {
    // The defensive half: handed the wrong row anyway, a column degrades
    // instead of unmounting the console.
    const { impl } = routedFetch({ "/api/artifacts": async () => ok([DECISION]) });
    render(wrap(impl, <RecordsView route="artifacts" filter="" />));

    await screen.findByText("DEC-1");
    expect(screen.getByRole("heading", { name: "Artifacts" })).toBeTruthy();
  });

  it("resets the status filter when the route changes", async () => {
    const { impl, calls } = routedFetch({
      "/api/artifacts": async () => ok([ARTIFACT]),
      "/api/decisions": async () => ok([DECISION]),
    });

    const { rerender } = render(
      wrap(impl, <RecordsView key="artifacts" route="artifacts" filter="" />),
    );
    await screen.findByText("ART-1");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "accepted");
    await waitFor(() => expect(calls.some((u) => u.includes("status=accepted"))).toBe(true));

    rerender(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" />));
    await screen.findByText("DEC-1");

    // A status chosen for artifacts says nothing about decisions; the two
    // vocabularies do not even overlap.
    const decisionCalls = calls.filter((u) => u.includes("/api/decisions"));
    expect(decisionCalls.length).toBeGreaterThan(0);
    expect(decisionCalls.every((u) => !u.includes("status="))).toBe(true);
  });

  it("keeps rows on screen while the same route refreshes", async () => {
    // The counterpart guarantee: remounting per route must not turn an
    // ordinary refresh into a blank table.
    let call = 0;
    const { impl } = routedFetch({
      "/api/artifacts": async () => {
        call += 1;
        return call === 1 ? ok([ARTIFACT]) : new Promise<Response>(() => {});
      },
    });

    const { rerender } = render(
      wrap(impl, <RecordsView route="artifacts" filter="" reloadKey={0} />),
    );
    await screen.findByText("ART-1");

    rerender(wrap(impl, <RecordsView route="artifacts" filter="" reloadKey={1} />));
    await waitFor(() => expect(call).toBe(2));

    // Same resource, refresh in flight: the loaded row stays visible.
    expect(screen.getByText("ART-1")).toBeTruthy();
  });
});
