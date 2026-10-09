/**
 * Escape with a sheet open over an inspector closes the sheet and nothing
 * else. Every layer used to listen on the document, so the inspector closed
 * and navigated under the sheet and left it open over the list.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { RecordsView } from "./RecordsView.tsx";

const DECISION = {
  id: "DEC-1",
  title: "Adopt the CLI bridge",
  status: "proposed",
  owner_id: "david",
  updated_at: "2026-07-26T10:00:00+00:00",
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

function show(onDetail: (id: string | null) => void) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const rows = String(input).includes("/api/decisions") ? [DECISION] : [];
    return new Response(JSON.stringify({ ok: true, data: rows }), { status: 200 });
  });
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl as typeof fetch)}>
      <RecordsView key="decisions" route="decisions" filter="" detail="DEC-1" onDetail={onDetail} />
    </AppProvider>,
  );
}

describe("Escape across layers", () => {
  it("closes the sheet on top and leaves the inspector beneath it open", async () => {
    const onDetail = vi.fn();
    show(onDetail);
    await screen.findByRole("complementary", { name: /decision DEC-1/ });
    await userEvent.click(screen.getByRole("button", { name: "Change status…" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("complementary", { name: /decision DEC-1/ })).toBeTruthy();
    expect(onDetail).not.toHaveBeenCalledWith(null);
  });

  it("closes the inspector with the next press, once the sheet is gone", async () => {
    const onDetail = vi.fn();
    show(onDetail);
    await screen.findByRole("complementary", { name: /decision DEC-1/ });
    await userEvent.click(screen.getByRole("button", { name: "Change status…" }));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.keyboard("{Escape}");

    expect(onDetail).toHaveBeenLastCalledWith(null);
  });
});
