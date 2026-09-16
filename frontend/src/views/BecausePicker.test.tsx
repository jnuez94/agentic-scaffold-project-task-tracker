import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client.ts";
import type { TaskDetail } from "../api/contract.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { BecausePicker } from "./BecausePicker.tsx";

const TASK = {
  id: "T-1",
  status: "review",
  reviews: [{ id: "REV-1", decision: "changes_requested", created_at: "2026-09-01T00:00:00+00:00" }],
} as unknown as TaskDetail;

function harness() {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    let data: unknown = [];
    if (url.includes("/api/decisions")) data = [{ id: "DEC-1", title: "Ruling on T-1", context: "", decision: "", evidence: "", implications: "" }];
    if (url.includes("/api/escalations")) data = [{ id: "ESC-1", status: "open", related_tasks: "T-1" }];
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
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

describe("BecausePicker", () => {
  it("loads nothing until opened, then offers reviews, naming decisions and open escalations", async () => {
    const { impl, calls } = harness();
    const onChange = vi.fn();
    render(wrap(impl, <BecausePicker task={TASK} value="" onChange={onChange} />));
    expect(calls.filter((url) => url.includes("/api/decisions") || url.includes("/api/escalations"))).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Add a cause…" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Escalation ESC-1" })).toBeTruthy());
    expect(calls.some((url) => url.includes("/api/escalations?status=open"))).toBe(true);
    expect(screen.getByRole("option", { name: "Review REV-1 — changes requested" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Decision DEC-1 — Ruling on T-1" })).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText("Because (optional)"), "review:REV-1");
    expect(onChange).toHaveBeenCalledWith("review:REV-1");
  });
});
