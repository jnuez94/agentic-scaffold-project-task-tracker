/**
 * Every dialog gives focus back to the control that opened it, on every
 * close path: submit, Cancel, the close button and Escape (UI-78). Where the
 * control is gone after the action — a recovered session no longer offers
 * "Recover…" — focus goes to the record's heading, never the body.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import type { RouteName } from "../state/useHashRoute.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { RecordsView } from "./RecordsView.tsx";

const LONG_AGO = "2026-01-01T00:00:00+00:00";

const agent = (id: string, name: string) => ({
  id, name, role: "Engineer", status: "active", actor_type: "agent", responsibilities: "", goal: "",
  operating_style: "", decision_authority: "", review_authority: "", escalation_rules: "",
  unavailable_for: "", created_at: LONG_AGO, updated_at: LONG_AGO,
});

function board() {
  return {
    decisions: [{ id: "D-1", title: "Adopt the bridge", status: "proposed", owner_id: "david", updated_at: LONG_AGO }],
    artifacts: [
      { id: "A-1", type: "spec", status: "draft", uri: "docs/a.md", owner_id: "david", related_tasks: [], usage_boundaries: "", updated_at: LONG_AGO },
    ],
    agents: [agent("local-operator", "Local Operator"), agent("bob", "Bob")],
    sessions: [
      { id: "S-1", agent_id: "carol", harness: "codex", model: "", status: "active", started_at: LONG_AGO, last_seen_at: LONG_AGO, ended_at: null },
    ],
  };
}

type Board = ReturnType<typeof board>;
const reply = (data: unknown) => new Response(JSON.stringify({ ok: true, data, audit_range: [9, 9] }), { status: 200 });

function serve(state: Board) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://console").pathname;
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as Record<string, string>;
      const [, , kind, id] = path.split("/");
      const row = (state[kind as keyof Board] as { id: string; status: string }[]).find((r) => r.id === id)!;
      if (path.endsWith("/recover")) {
        row.status = "ended";
        return reply({ id, previous_status: "active", status: "ended", recovered_tasks: [] });
      }
      Object.assign(row, body.status ? { status: body.status } : {}, body.type ? { type: body.type } : {});
      return reply(row);
    }
    const kind = path.split("/")[2] as keyof Board;
    return reply(path.split("/").length === 3 && state[kind] ? state[kind] : []);
  });
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

async function openDialog(route: RouteName, id: string, trigger: string) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const fetchImpl = serve(board());
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl as typeof fetch)}>
      <RecordsView key={route} route={route} filter="" detail={id} onDetail={() => {}} />
    </AppProvider>,
  );
  const user = userEvent.setup();
  const inspector = await screen.findByRole("complementary", { name: new RegExp(`${id}$`) });
  const opener = within(inspector).getByRole("button", { name: trigger });
  await user.click(opener);
  const dialog = await screen.findByRole("dialog");
  return { user, opener, dialog, inspector };
}

type Case = {
  name: string;
  route: RouteName;
  id: string;
  trigger: string;
  closeLabel: string;
  submit: (user: UserEvent, dialog: HTMLElement) => Promise<void>;
};

const CASES: Case[] = [
  {
    name: "decision status",
    route: "decisions",
    id: "D-1",
    trigger: "Change status…",
    closeLabel: "Close",
    submit: async (user, dialog) => {
      await user.selectOptions(within(dialog).getByLabelText("New status"), "superseded");
      await user.type(within(dialog).getByLabelText("Why"), "Replaced.");
      await user.click(within(dialog).getByRole("button", { name: "Change status" }));
    },
  },
  {
    name: "artifact status",
    route: "artifacts",
    id: "A-1",
    trigger: "Change status…",
    closeLabel: "Close",
    submit: async (user, dialog) => {
      await user.selectOptions(within(dialog).getByLabelText("New status"), "review");
      await user.click(within(dialog).getByRole("button", { name: "Change status" }));
    },
  },
  {
    name: "artifact correction",
    route: "artifacts",
    id: "A-1",
    trigger: "Correct record…",
    closeLabel: "Close",
    submit: async (user, dialog) => {
      const type = within(dialog).getByLabelText("Type");
      await user.clear(type);
      await user.type(type, "design");
      await user.click(within(dialog).getByRole("button", { name: "Correct record" }));
    },
  },
  {
    name: "agent retirement",
    route: "agents",
    id: "bob",
    trigger: "Retire agent…",
    closeLabel: "Close",
    submit: async (user, dialog) => {
      await user.click(within(dialog).getByRole("button", { name: /retire agent/i }));
    },
  },
];

describe.each(CASES)("the $name dialog", ({ route, id, trigger, closeLabel, submit }) => {
  it.each([
    ["Cancel", (user: UserEvent, dialog: HTMLElement) => user.click(within(dialog).getByRole("button", { name: "Cancel" }))],
    ["the close button", (user: UserEvent, dialog: HTMLElement) => user.click(within(dialog).getByRole("button", { name: closeLabel }))],
    ["Escape", (user: UserEvent) => user.keyboard("{Escape}")],
  ])("returns focus to its opener after %s", async (_path, close) => {
    const { user, opener, dialog } = await openDialog(route, id, trigger);
    await close(user, dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to its opener after a successful submit", async () => {
    const { user, opener, dialog } = await openDialog(route, id, trigger);
    await submit(user, dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe("the session recovery dialog", () => {
  it.each([
    ["Cancel", (user: UserEvent, dialog: HTMLElement) => user.click(within(dialog).getByRole("button", { name: "Cancel" }))],
    ["the close button", (user: UserEvent, dialog: HTMLElement) =>
      user.click(within(dialog).getByRole("button", { name: "Close session recovery" }))],
    ["Escape", (user: UserEvent) => user.keyboard("{Escape}")],
  ])("returns focus to its opener after %s", async (_path, close) => {
    const { user, opener, dialog } = await openDialog("sessions", "S-1", "Recover…");
    await close(user, dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("lands on the session's heading once recovery has removed its opener", async () => {
    const { user, dialog, inspector } = await openDialog("sessions", "S-1", "Recover…");
    await user.type(within(dialog).getByLabelText(/reason/i), "laptop closed overnight");
    await user.click(within(dialog).getByRole("button", { name: /recover session/i }));
    await user.click(await within(dialog).findByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(within(inspector).queryByRole("button", { name: "Recover…" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(inspector).getByRole("heading", { level: 2 })));
  });
});
