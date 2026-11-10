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

function ok(rows: unknown): Response {
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
    await waitFor(() =>
      expect(calls.some((u) => u.includes("where=status%3Aeq%3Daccepted"))).toBe(true),
    );

    rerender(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" />));
    await screen.findByText("DEC-1");

    // A status chosen for artifacts says nothing about decisions; the two
    // vocabularies do not even overlap.
    const decisionCalls = calls.filter((u) => u.includes("/api/decisions"));
    expect(decisionCalls.length).toBeGreaterThan(0);
    expect(decisionCalls.every((u) => !u.includes("where="))).toBe(true);
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

  it("shows the inspected record as it is after a refresh, not as it was opened", async () => {
    let status = "proposed";
    const { impl } = routedFetch({
      "/api/decisions": async () => ok([{ ...DECISION, status }]),
    });
    const { rerender } = render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" reloadKey={0} />),
    );
    await userEvent.click(await screen.findByText("DEC-1"));
    const inspector = await screen.findByRole("complementary", { name: /decision DEC-1/ });
    expect(inspector.textContent).toContain("proposed");

    // A ruling from the inspector refreshes the list; the open inspector must follow.
    status = "accepted";
    rerender(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" reloadKey={1} />));
    await waitFor(() =>
      expect(
        screen.getByRole("complementary", { name: /decision DEC-1/ }).textContent,
      ).toContain("accepted"),
    );
  });

  it("resolves a deep link from the loaded rows without asking show", async () => {
    const { impl, calls } = routedFetch({ "/api/decisions": async () => ok([DECISION]) });
    render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" detail="DEC-1" onDetail={() => {}} />),
    );
    await screen.findByRole("complementary", { name: /decision DEC-1/ });
    expect(calls.some((url) => url.includes("/api/decisions/DEC-1"))).toBe(false);
  });

  it("resolves a deep link through show when the window does not hold the row", async () => {
    const { impl, calls } = routedFetch({
      "/api/decisions/DEC-9": async () => new Response(JSON.stringify({ ok: true, data: { ...DECISION, id: "DEC-9" } }), { status: 200 }),
      "/api/decisions": async () => ok([DECISION]),
    });
    render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" detail="DEC-9" onDetail={() => {}} />),
    );
    await screen.findByRole("complementary", { name: /decision DEC-9/ });
    expect(calls.some((url) => url.includes("/api/decisions/DEC-9"))).toBe(true);
  });

  it("gives an unknown id the not-found treatment and clears the route on dismiss", async () => {
    const { impl } = routedFetch({
      "/api/decisions/NOPE": async () =>
        new Response(JSON.stringify({ ok: false, error: { code: "not_found", message: "Not found: decision NOPE" } }), { status: 404 }),
      "/api/decisions": async () => ok([DECISION]),
    });
    const onDetail = vi.fn();
    render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" detail="NOPE" onDetail={onDetail} />),
    );
    await screen.findByText("Not found: decision NOPE");
    expect(screen.queryByRole("complementary")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(onDetail).toHaveBeenCalledWith(null);
  });

  it("puts the opened row's id in the route and clears it on close", async () => {
    const { impl } = routedFetch({ "/api/decisions": async () => ok([DECISION]) });
    const onDetail = vi.fn();
    render(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" onDetail={onDetail} />));
    await userEvent.click(await screen.findByText("DEC-1"));
    expect(onDetail).toHaveBeenLastCalledWith("DEC-1");
    await userEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(onDetail).toHaveBeenLastCalledWith(null);
  });

  it("closes a record opened earlier when the route then names one that does not resolve", async () => {
    const { impl } = routedFetch({
      "/api/decisions/NOPE": async () =>
        new Response(JSON.stringify({ ok: false, error: { code: "not_found", message: "Not found: decision NOPE" } }), { status: 404 }),
      "/api/decisions": async () => ok([DECISION]),
    });
    const { rerender } = render(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" detail="DEC-1" onDetail={() => {}} />),
    );
    await screen.findByRole("complementary", { name: /decision DEC-1/ });

    rerender(
      wrap(impl, <RecordsView key="decisions" route="decisions" filter="" detail="NOPE" onDetail={() => {}} />),
    );
    await screen.findByText("Not found: decision NOPE");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("re-asks the CLI in a header's order when the contract can order by it", async () => {
    const { impl, calls } = routedFetch({ "/api/decisions": async () => ok([DECISION]) });
    render(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" />));
    await screen.findByText("DEC-1");

    await userEvent.click(screen.getByRole("button", { name: /^Status/ }));
    await waitFor(() => expect(calls.some((u) => u.includes("order_by=status%3Aasc"))).toBe(true));
  });

  it("asks for the newest rows first, and loads older ones on request (UI-86)", async () => {
    const page = Array.from({ length: 500 }, (_, index) => ({ ...DECISION, id: `DEC-N${index}` }));
    // The older page starts on the last row held, then brings what follows it.
    const older = [page[499], { ...DECISION, id: "DEC-OLD" }];
    const { impl, calls } = routedFetch({
      "/api/decisions": async () => ok(calls.at(-1)!.includes("offset=499") ? older : page),
      // A ledger nothing was written to, so the older page joins the window.
      "/api/summary": async () => ok({ audit_cursor: 1 }),
      "/api/audit": async () => ok([]),
    });
    render(wrap(impl, <RecordsView key="decisions" route="decisions" filter="" />));
    await screen.findByText("DEC-N0");
    const first = calls.find((u) => u.includes("/api/decisions"))!;
    expect(first).toContain("order_by=created_at%3Adesc");
    expect(first).toContain("offset=0");

    await userEvent.click(screen.getByRole("button", { name: "Load older" }));
    await waitFor(() => expect(calls.some((u) => u.includes("offset=499"))).toBe(true));
    await screen.findByText("DEC-N0");
    // The older page came back short, so the window is whole and the control goes.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load older" })).toBeNull());
  });

  it("keeps Load older when the filter matches nothing in the newest page (UI-86)", async () => {
    const page = Array.from({ length: 500 }, (_, index) => ({ ...DECISION, id: `DEC-N${index}` }));
    const older = [page[499], { ...DECISION, id: "DEC-OLD", title: "Retire the needle" }];
    const { impl, calls } = routedFetch({
      "/api/decisions": async () => ok(calls.at(-1)!.includes("offset=499") ? older : page),
      // A ledger nothing was written to, so the older page joins the window.
      "/api/summary": async () => ok({ audit_cursor: 1 }),
      "/api/audit": async () => ok([]),
    });
    render(wrap(impl, <RecordsView key="decisions" route="decisions" filter="needle" />));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    // Nothing among the newest 500 matches, but the control stays.
    const control = await screen.findByRole("button", { name: "Load older" });
    expect(screen.queryByText("DEC-OLD")).toBeNull();

    await userEvent.click(control);
    await screen.findByText("DEC-OLD");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Load older" })).toBeNull());
  });

  describe("the inspected escalation after a ruling (UI-87)", () => {
    const OPEN = {
      id: "ESC-9",
      raised_by: "greg",
      owner_id: "owner",
      status: "open",
      issue: "Which lane?",
      resolution: null,
      related_tasks: [],
      created_at: "2026-11-10T00:00:00+00:00",
      updated_at: "2026-11-10T00:00:00+00:00",
    };
    const RESOLVED = { ...OPEN, status: "resolved", resolution: "Take lane B", updated_at: "2026-11-10T00:05:00+00:00" };

    it("re-reads a record the Open filter dropped, by id", async () => {
      let resolved = false;
      const { impl } = routedFetch({
        "/api/escalations/ESC-9": async () => okOne(resolved ? RESOLVED : OPEN),
        "/api/escalations": async () => ok(resolved ? [] : [OPEN]),
      });
      const view = (reloadKey: number) =>
        wrap(impl, <RecordsView route="escalations" filter="" detail="ESC-9" reloadKey={reloadKey} />);
      const { rerender } = render(view(0));
      await screen.findByText("Which lane?");
      expect(screen.queryByText("Take lane B")).toBeNull();

      resolved = true;
      rerender(view(1));
      await screen.findByText("Take lane B");
    });

    it("re-reads a deep-linked record the window never held", async () => {
      let resolved = false;
      const { impl } = routedFetch({
        "/api/escalations/ESC-9": async () => okOne(resolved ? RESOLVED : OPEN),
        "/api/escalations": async () => ok([]),
      });
      const view = (reloadKey: number) =>
        wrap(impl, <RecordsView route="escalations" filter="" detail="ESC-9" reloadKey={reloadKey} />);
      const { rerender } = render(view(0));
      await screen.findByText("Which lane?");

      resolved = true;
      rerender(view(1));
      await screen.findByText("Take lane B");
    });
  });
});

describe("RecordsView when the open tasks cannot be read whole (UI-88)", () => {
  it("carries the unknown state into the retirement sheet", async () => {
    const AGENT = { id: "greg", name: "Greg", role: "pm", actor_type: "ai", status: "active", capabilities: "" };
    // Every page of open tasks comes back full, so the full read is refused.
    const full = Array.from({ length: 500 }, (_, index) => ({ id: `T-${index}`, status: "todo", assignees: ["greg"] }));
    const { impl } = routedFetch({
      "/api/agents": async () => ok([AGENT]),
      "/api/tasks": async () => ok(full),
      "/api/sessions": async () => ok([]),
    });
    const store = new IdentityStore({
      getItem: () => JSON.stringify({ actorId: "local-operator", sessionId: "console-1" }),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    render(
      <AppProvider store={store} client={new ApiClient(() => "console-1", "", impl)}>
        <RecordsView route="agents" filter="" detail="greg" />
      </AppProvider>,
    );
    const retire = await screen.findByRole("button", { name: "Retire agent…" });
    await waitFor(() => expect((retire as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(retire);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be checked"), { timeout: 4000 });
  });
});

function okOne(row: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data: row }), { status: 200 });
}
