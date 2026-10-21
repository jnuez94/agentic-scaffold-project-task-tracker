/**
 * "Since you loaded it" under a refused change (UI-33): the record's changes
 * after the loaded state, newest first, at most five, with the operator's own
 * field called out — and nothing at all when the history cannot say.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import { EDITING } from "../lib/sinceLoaded.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { ConflictBanner } from "./ConflictBanner.tsx";
import { SinceLoaded } from "./SinceLoaded.tsx";

const row = (id: number, action: string, detail: string, actor = "david"): AuditEntry => ({
  id,
  actor,
  session_id: "s-1",
  action,
  object_type: "task",
  object_id: "T-1",
  detail,
  created_at: new Date(Date.now() - (100 - id) * 60_000).toISOString(),
});

function wrap(history: AuditEntry[] | "fails", children: React.ReactNode) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
    history === "fails" || !String(input).includes("/api/audit")
      ? new Response(JSON.stringify({ ok: false, error: { code: "database_busy", message: "busy" } }), { status: 503 })
      : new Response(JSON.stringify({ ok: true, data: [...history].reverse() }), { status: 200 }),
  );
  render(
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl as typeof fetch)}>
      {children}
    </AppProvider>,
  );
  return fetchImpl;
}

const TASK_HISTORY = [
  row(1, "claim", "revision 1 -> 2"),
  row(2, "status", "in_progress -> review; revision 2 -> 3", "michael-ux"),
  row(3, "assign", "add=toby; remove=; revision 3 -> 4", "local-operator"),
];

describe("SinceLoaded", () => {
  it("lists the changes after the loaded revision, newest first, with who and when", async () => {
    wrap(TASK_HISTORY, <SinceLoaded objectType="task" objectId="T-1" loaded={{ revision: 2 }} />);
    await screen.findByText("Since you loaded it");
    const lines = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Assignees: \+ toby · local-operator · .+ ago$/);
    expect(lines[1]).toMatch(/^Status: in_progress -> review · michael-ux · /);
  });

  it("leads with the operator's own field when it changed too", async () => {
    wrap(TASK_HISTORY, <SinceLoaded objectType="task" objectId="T-1" loaded={{ revision: 2 }} editing={EDITING.assignees} />);
    await screen.findByText("You were editing Assignees — it changed too.");
  });

  it("shows five and points at Activity for the rest", async () => {
    const long = Array.from({ length: 8 }, (_, index) => row(index + 1, "update", `fields=next_steps; revision ${index + 1} -> ${index + 2}`));
    const onShowActivity = vi.fn();
    wrap(long, <SinceLoaded objectType="task" objectId="T-1" loaded={{ revision: 1 }} onShowActivity={onShowActivity} />);
    await screen.findByText("Since you loaded it");
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "and 3 more in Activity" }));
    expect(onShowActivity).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the history places nothing after the loaded state", async () => {
    const fetchImpl = wrap(TASK_HISTORY, <SinceLoaded objectType="task" objectId="T-1" loaded={{ revision: 4 }} />);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText("Since you loaded it")).toBeNull();
  });

  it("renders nothing when the history cannot be read", async () => {
    const fetchImpl = wrap("fails", <SinceLoaded objectType="task" objectId="T-1" loaded={{ revision: 1 }} />);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(screen.queryByText("Since you loaded it")).toBeNull();
  });
});

describe("the task conflict banner", () => {
  it("keeps Reload latest and adds what changed since the submitted revision", async () => {
    const fetchImpl = wrap(
      TASK_HISTORY,
      <ConflictBanner
        error={new ApiError("stale_task_revision", "stale", 409, { actual_revision: 4 })}
        taskId="T-1"
        currentRevision={3}
        onReload={() => {}}
      />,
    );
    await screen.findByText("Since you loaded it");
    expect(screen.getByRole("button", { name: "Reload latest" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent?.split(" · ")[0])).toEqual(["Assignees: + toby"]);
    expect(decodeURIComponent(String(fetchImpl.mock.calls[0]?.[0]))).toContain("object_id=T-1");
  });
});
