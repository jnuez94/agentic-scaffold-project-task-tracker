/**
 * "Why this is blocked" from what blocks the task (UI-83): its active blocks
 * dependencies with their statuses, the cause cited when it was blocked, or a
 * stated absence — never the "Does not authorize" boundary or the notes.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry, Dependency, TaskDetail } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { Overview } from "./TaskOverview.tsx";

const HOLD = "OPERATOR HOLD: DO NOT RELEASE.";
const BOUNDARY = "This task does not authorize release, accept security risk, or approve any schema change.";

const blocks = (on: string, status: Dependency["status"] = "active"): Dependency => ({
  task_id: "REL-1",
  depends_on_task_id: on,
  dependency_type: "blocks",
  status,
  rationale: "",
  created_at: "2026-09-15T00:00:00+00:00",
});

/** Shaped like the release task: the hold in notes, the boundary in blocked_claims. */
function relShaped(over: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "REL-1",
    title: "First-release go/no-go",
    status: "blocked",
    priority: 1,
    description: "",
    acceptance_criteria: "",
    next_steps: "",
    blocked_claims: BOUNDARY,
    notes: HOLD,
    tags: "release",
    assignees: [],
    claimed_by: null,
    claim_session_id: null,
    claimed_at: null,
    evidence_count: 0,
    created_at: "2026-07-27T00:00:00+00:00",
    created_by: "michael-ux",
    updated_at: "2026-09-16T00:00:00+00:00",
    revision: 19,
    evidence: [],
    dependencies: [blocks("SEC-1"), blocks("UX-12"), blocks("DOC-3", "resolved")],
    reviews: [],
    ...over,
  };
}

const move = (id: number, detail: string): AuditEntry => ({
  id,
  actor: "michael-ux",
  session_id: "s-1",
  action: "status",
  object_type: "task",
  object_id: "REL-1",
  detail,
  created_at: "2026-07-27T00:00:00+00:00",
});

function show(task: TaskDetail, history: AuditEntry[]) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const data = url.includes("/api/audit")
      ? history
      : url.includes("/api/tasks")
        ? [
            { id: "SEC-1", status: "todo" },
            { id: "UX-12", status: "review" },
          ]
        : [];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  });
  render(
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl as typeof fetch)}>
      <Overview detail={task} />
    </AppProvider>,
  );
  return { calls, note: () => screen.getByRole("note") };
}

describe("Why this is blocked", () => {
  it("names what the task waits on, with each blocker's status and a link", async () => {
    const { note, calls } = show(relShaped(), [move(1053, "in_progress -> blocked; revision 6 -> 7")]);
    await waitFor(() => expect(note().textContent).toContain("Waits on SEC-1 (to do) and UX-12 (in review)."));
    expect(screen.getByRole("link", { name: "SEC-1" }).getAttribute("href")).toBe("#/tasks/SEC-1");
    // One list call for every blocker's status, not one per blocker.
    expect(calls.filter((url) => url.includes("/api/tasks")).length).toBe(1);
    expect(decodeURIComponent(calls.find((url) => url.includes("/api/tasks"))!)).toContain("id:in=SEC-1,UX-12");
  });

  it("never shows the boundary or the hold as the reason", async () => {
    const { note } = show(relShaped(), [move(1053, "in_progress -> blocked; revision 6 -> 7")]);
    await waitFor(() => expect(note().textContent).toContain("Waits on"));
    expect(note().textContent).not.toContain(BOUNDARY);
    expect(note().textContent).not.toContain(HOLD);
  });

  it("gives the cause cited when it was blocked", async () => {
    const { note } = show(relShaped({ dependencies: [] }), [
      move(900, "in_progress -> blocked; revision 2 -> 3; because=escalation:ESC-REL1-1"),
    ]);
    await waitFor(() => expect(note().textContent).toContain("Blocked because of escalation ESC-REL1-1."));
    expect(screen.getByRole("link", { name: "escalation ESC-REL1-1" }).getAttribute("href")).toBe(
      "#/escalations/ESC-REL1-1",
    );
  });

  it("states the absence when neither exists, and not before the history is read", async () => {
    const { note } = show(relShaped({ dependencies: [] }), [move(1053, "in_progress -> blocked; revision 6 -> 7")]);
    expect(note().textContent).not.toContain("No reason was recorded");
    await waitFor(() => expect(note().textContent).toContain("No reason was recorded when this was blocked."));
    expect(note().textContent).not.toContain(HOLD);
  });

  it("keeps the boundary under its own name, and the notes in full", async () => {
    show(relShaped(), []);
    expect(screen.getByText("Does not authorize")).toBeTruthy();
    expect(screen.getByText(BOUNDARY)).toBeTruthy();
    expect(screen.getByText(HOLD)).toBeTruthy();
    expect(screen.queryByText("Blocked claims")).toBeNull();
  });
});
