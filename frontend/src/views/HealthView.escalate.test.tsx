/**
 * Health's "Escalate…" opens the form on the task with the issue empty
 * (UI-49). On the release task the notes are the operator's hold and the
 * blocked claims state what it does not authorise; neither may become an
 * escalation's issue by default.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import type { Health, Task } from "../api/contract.ts";
import { takeEscalationIntent } from "../lib/escalationIntent.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { HealthView } from "./HealthView.tsx";

const blocked = (over: Partial<Task>): Task => ({
  id: "REL-9",
  title: "Release gate",
  description: "",
  status: "blocked",
  priority: 1,
  tags: "",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "This task does not authorize release.",
  notes: "OPERATOR HOLD: DO NOT RELEASE.",
  revision: 1,
  created_by: "alice",
  created_at: "2026-09-01T00:00:00+00:00",
  updated_at: "2026-09-10T00:00:00+00:00",
  ...over,
});

function health(task: Task): Health {
  return {
    healthy: false,
    unowned_tasks: [],
    stale_tasks: [],
    stale_sessions: [],
    unclaimed_in_progress_tasks: [],
    invalid_active_claims: [],
    active_blockers: [task],
    done_without_evidence: [],
    open_escalations: [],
    tasks_awaiting_review: [],
    anomalies: { active_blockers: [task] },
    informational: {},
    truncated_sections: [],
  };
}

async function escalateFromHealth(task: Task) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.includes("/api/health") ? health(task) : url.includes("/api/doctor") ? null : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  });
  render(
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl as typeof fetch)}>
      <HealthView />
    </AppProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Escalate…" }));
  return takeEscalationIntent(task.id);
}

afterEach(() => {
  globalThis.location.hash = "";
});

describe("Escalate from Health", () => {
  it("opens on the task without quoting the operator's hold from its notes", async () => {
    const intent = await escalateFromHealth(blocked({}));
    expect(intent).toEqual({ taskId: "REL-9", issue: "" });
  });

  it("does not quote the blocked claims either", async () => {
    const intent = await escalateFromHealth(blocked({ notes: "" }));
    expect(intent?.issue).toBe("");
  });
});
