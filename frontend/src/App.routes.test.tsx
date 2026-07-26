/**
 * Route lifecycle at the App boundary (UI-15, work package 1).
 *
 * RecordsView.test.tsx proves that a keyed records view discards the previous
 * entity's rows. It cannot prove that App supplies that key — it passes one
 * itself — so removing the key in App would leave that suite green while the
 * stop-ship crash came straight back. This suite drives the real component and
 * the real router, so it fails if the key goes away.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { ApiClient } from "./api/client.ts";
import { AppProvider } from "./state/AppContext.tsx";
import { IdentityStore } from "./state/identityStore.ts";

const DECISION = {
  id: "DEC-STALE-1",
  title: "Adopt the CLI bridge",
  status: "accepted",
  owner_id: "david",
  updated_at: "2026-07-26T10:00:00+00:00",
  // No related_tasks: the field the Artifacts columns join.
};

function ok(rows: unknown[]): Response {
  return new Response(JSON.stringify({ ok: true, data: rows }), { status: 200 });
}

function meta(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      data: { database: "/tmp/coordination.sqlite3", cli_version: "1.2.0", schema: "v1" },
    }),
    { status: 200 },
  );
}

function consoleFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/meta")) return meta();
    if (url.includes("/api/decisions")) return ok([DECISION]);
    // Artifacts never answers, holding the app in the transition render where
    // the previous route's rows were still mounted.
    if (url.includes("/api/artifacts")) return new Promise<Response>(() => {});
    return ok([]);
  }) as unknown as typeof fetch;
}

function renderApp(fetchImpl: typeof fetch) {
  return render(
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      <App />
    </AppProvider>,
  );
}

afterEach(() => {
  globalThis.location.hash = "";
});

describe("App route lifecycle", () => {
  it("drops the previous entity's rows when the route changes", async () => {
    globalThis.location.hash = "#/decisions";
    renderApp(consoleFetch());
    await screen.findByText("DEC-STALE-1");

    globalThis.location.hash = "#/artifacts";

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Artifacts" })).toBeTruthy(),
    );
    // The crash: this row reaching the Artifacts columns threw on .join and
    // unmounted the whole console.
    await waitFor(() => expect(screen.queryByText("DEC-STALE-1")).toBeNull());
    // The shell survived, which is the part the operator notices.
    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  it("keeps the shell mounted through the paced sequence that crashed", async () => {
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };

    try {
      globalThis.location.hash = "#/tasks";
      renderApp(consoleFetch());

      for (const route of [
        "#/reviews",
        "#/messages",
        "#/agents",
        "#/sessions",
        "#/decisions",
        "#/artifacts",
      ]) {
        globalThis.location.hash = route;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: "Artifacts" })).toBeTruthy(),
      );
    } finally {
      console.error = original;
    }

    expect(screen.getByRole("navigation")).toBeTruthy();
    expect(errors.filter((message) => message.includes("join"))).toEqual([]);
  });
});
