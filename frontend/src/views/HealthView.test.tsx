/**
 * Health's two kinds of section (UI-65).
 *
 * Anomalies decide the healthy flag and the attention count; informational
 * sections are rendered below them, quieter, and never counted as attention.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { Health, Task, TaskListRow } from "../api/contract.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { HealthView } from "./HealthView.tsx";

const task = (id: string, updated_at: string, title = `Task ${id}`): Task => ({
  id,
  title,
  description: "",
  status: "review",
  priority: 2,
  tags: "",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "",
  notes: "",
  revision: 1,
  created_by: "alice",
  created_at: "2026-09-01T00:00:00+00:00",
  updated_at,
});

const listRow = (base: Task, overrides: Partial<TaskListRow> = {}): TaskListRow => ({
  ...base,
  claimed_by: null,
  claim_session_id: null,
  claimed_at: null,
  assignees: [],
  evidence_count: 0,
  ...overrides,
});

const NEWER = task("T-2", "2026-09-14T00:00:00+00:00", "Reviewed second");
const OLDER = task("T-1", "2026-09-10T00:00:00+00:00", "Reviewed first");
const UNOWNED = task("T-7", "2026-09-12T00:00:00+00:00", "Nobody's");

function healthPayload(overrides: Partial<Health> = {}): Health {
  const empty: Health = {
    healthy: true,
    unowned_tasks: [],
    stale_tasks: [],
    stale_sessions: [],
    unclaimed_in_progress_tasks: [],
    invalid_active_claims: [],
    active_blockers: [],
    done_without_evidence: [],
    open_escalations: [],
    tasks_awaiting_review: [],
    anomalies: {},
    informational: {},
    truncated_sections: [],
  };
  return { ...empty, ...overrides };
}

function healthFetch(health: Health, tasks: TaskListRow[]) {
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.includes("/api/health") ? health : url.includes("/api/tasks") ? tasks : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  });
  return impl as unknown as typeof fetch;
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

describe("HealthView with informational sections", () => {
  it("stays healthy and uncounted when only informational sections have rows", async () => {
    const health = healthPayload({
      tasks_awaiting_review: [NEWER, OLDER],
      informational: { tasks_awaiting_review: [NEWER, OLDER] },
    });
    render(wrap(healthFetch(health, [listRow(NEWER), listRow(OLDER)]), <HealthView />));

    await screen.findByText("Informational");
    expect(screen.getByText("No findings")).toBeTruthy();
    expect(screen.getByText("These do not affect the healthy flag.")).toBeTruthy();
    expect(screen.getByText(/Awaiting review/)).toBeTruthy();
  });

  it("counts only anomaly sections as needing attention", async () => {
    const health = healthPayload({
      healthy: false,
      unowned_tasks: [UNOWNED],
      anomalies: { unowned_tasks: [UNOWNED] },
      tasks_awaiting_review: [NEWER, OLDER],
      informational: { tasks_awaiting_review: [NEWER, OLDER] },
    });
    render(wrap(healthFetch(health, []), <HealthView />));

    await screen.findByText("Informational");
    expect(screen.getByText("1 section needs attention")).toBeTruthy();
  });

  it("orders awaiting-review rows longest since update first, linked, with the implementer", async () => {
    const health = healthPayload({
      tasks_awaiting_review: [NEWER, OLDER],
      informational: { tasks_awaiting_review: [NEWER, OLDER] },
    });
    const tasks = [listRow(NEWER, { claimed_by: "alice" }), listRow(OLDER, { assignees: ["bob"] })];
    render(wrap(healthFetch(health, tasks), <HealthView />));

    const group = await screen.findByRole("region", { name: "Informational" });
    const items = within(group).getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("T-1");
    expect(items[0]).toContain("bob");
    expect(items[1]).toContain("T-2");
    expect(items[1]).toContain("alice");
    expect(items[0]).toMatch(/updated/);
    expect(within(group).getByRole("link", { name: "T-1" }).getAttribute("href")).toBe("#/tasks/T-1");
  });

  it("renders a section this console has never heard of, generically", async () => {
    const health = healthPayload({
      informational: { recently_released: [{ id: "T-9", title: "Freed up" }] },
    });
    render(wrap(healthFetch(health, []), <HealthView />));

    await screen.findByText("Informational");
    expect(screen.getByText(/Recently released/)).toBeTruthy();
    expect(screen.getByText("T-9")).toBeTruthy();
    expect(screen.getByText(/Freed up/)).toBeTruthy();
  });

  it("marks a capped informational section rather than claiming an exact count", async () => {
    const health = healthPayload({
      informational: { tasks_awaiting_review: [NEWER, OLDER] },
      truncated_sections: ["tasks_awaiting_review"],
    });
    render(wrap(healthFetch(health, []), <HealthView />));

    const group = await screen.findByRole("region", { name: "Informational" });
    expect(within(group).getByText("2+")).toBeTruthy();
    expect(within(group).getByText("2+").getAttribute("title")).toBe("More rows exist than are shown");
  });

  it("omits the group entirely when every informational section is empty", async () => {
    render(wrap(healthFetch(healthPayload(), []), <HealthView />));
    await screen.findByText("No findings");
    expect(screen.queryByText("Informational")).toBeNull();
  });
});
