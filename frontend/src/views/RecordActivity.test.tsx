import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { AuditEntry } from "../api/contract.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { RecordActivity } from "./RecordActivity.tsx";

const ENTRY: AuditEntry = {
  id: 1902,
  actor: "david",
  session_id: "david-fe-1",
  action: "status",
  object_type: "decision",
  object_id: "DEC-1",
  detail: "proposed -> superseded; Replaced by DEC-2.",
  created_at: "2026-09-16T09:00:00+00:00",
};

function activityFetch(rows: AuditEntry[]) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/audit")) calls.push(url);
    return new Response(JSON.stringify({ ok: true, data: url.includes("/api/audit") ? rows : [] }), { status: 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function wrap(fetchImpl: typeof fetch, children: ReactNode) {
  return (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
}

describe("RecordActivity", () => {
  it("asks for the record's own rows and renders them as a timeline", async () => {
    const { impl, calls } = activityFetch([ENTRY]);
    render(wrap(impl, <RecordActivity objectType="decision" objectId="DEC-1" />));
    await screen.findByText(/Replaced by DEC-2/);
    expect(calls[0]).toContain("object_type=decision");
    expect(calls[0]).toContain("object_id=DEC-1");
    expect(screen.getByText("david")).toBeTruthy();
  });

  it("says when nothing was recorded", async () => {
    const { impl } = activityFetch([]);
    render(wrap(impl, <RecordActivity objectType="decision" objectId="DEC-1" />));
    await screen.findByText("No recorded activity");
  });
});
