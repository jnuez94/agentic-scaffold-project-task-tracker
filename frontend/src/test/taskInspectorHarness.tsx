/**
 * A queue and its task inspector, for the focus and discard tests (UI-81).
 *
 * Rows are plain buttons standing in for the queue's rows: what matters is
 * that a focused control opened the inspector, which is true of both. The
 * fetch answers the task, the lists the inspector asks for, and the writes
 * its inline forms make.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import type { Agent, TaskDetail } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { TaskInspector } from "../views/TaskInspector.tsx";

const agent = (id: string, name: string): Agent =>
  ({ id, name, role: "Engineer", actor_type: "ai", status: "active" }) as Agent;

export const AGENTS: Agent[] = [agent("local-operator", "Local Operator"), agent("michael-ux", "Michael")];

export function taskDetail(id: string): TaskDetail {
  return {
    id,
    title: `Task ${id} title`,
    description: "",
    status: "blocked",
    priority: 2,
    tags: "",
    acceptance_criteria: "",
    next_steps: "",
    blocked_claims: "",
    notes: "",
    revision: 3,
    created_by: "local-operator",
    created_at: "2026-10-01T00:00:00+00:00",
    updated_at: "2026-10-01T00:00:00+00:00",
    claimed_by: null,
    claim_session_id: null,
    claimed_at: null,
    assignees: [],
    evidence_count: 0,
    evidence: [],
    dependencies: [],
    reviews: [],
  };
}

const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data, audit_range: [7, 7] }), { status: 200 });

function serve() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://console").pathname;
    if (init?.method === "POST") {
      if (path === "/api/escalations") return ok({ id: "ESC-1" });
      if (path === "/api/evidence") return ok({ id: 1 });
      return ok({ revision: 4, assignees: [] });
    }
    const task = path.match(/^\/api\/tasks\/([^/]+)$/);
    return ok(task ? taskDetail(task[1]!) : []);
  });
}

function Board({ initial }: { initial: string | null }) {
  const [selected, setSelected] = useState<string | null>(initial);
  return (
    <main>
      <h1>Tasks</h1>
      {["T-1", "T-2"].map((id) => (
        <button key={id} type="button" onClick={() => setSelected(id)}>
          Row {id}
        </button>
      ))}
      {selected ? (
        <TaskInspector taskId={selected} agents={AGENTS} onClose={() => setSelected(null)} onChanged={() => {}} />
      ) : null}
    </main>
  );
}

/** The board, with an actor and session; `initial` opens a task as a deep link would. */
export function renderBoard(initial: string | null = null) {
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const fetchImpl = serve();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl as typeof fetch)}>
      <Board initial={initial} />
    </AppProvider>,
  );
  return { user: userEvent.setup(), fetchImpl };
}

export const inspector = (id = "T-1") => screen.findByRole("complementary", { name: `Task ${id}` });
export const inspectorTitle = (id = "T-1") => screen.findByRole("heading", { name: `Task ${id} title` });
