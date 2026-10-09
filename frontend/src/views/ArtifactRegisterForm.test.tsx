import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { ArtifactRegisterForm } from "./ArtifactRegisterForm.tsx";

const AGENTS = [
  { id: "local-operator", name: "Local Operator", status: "active" },
  { id: "alice", name: "Alice", status: "active" },
  { id: "old", name: "Old", status: "inactive" },
] as Agent[];

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function harness() {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/api/artifacts") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      return new Response(JSON.stringify({ ok: true, data: { id: body.id, status: body.status }, audit_range: [7, 7] }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function show(fetchImpl: typeof fetch) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onCreated = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <ArtifactRegisterForm agents={AGENTS} onClose={() => {}} onCreated={onCreated} />
    </AppProvider>,
  );
  return { onCreated };
}

describe("ArtifactRegisterForm", () => {
  it("defaults the owner to the acting actor and offers only active agents", () => {
    show(harness().fetchImpl);
    expect(screen.getByLabelText<HTMLSelectElement>("Owner").value).toBe("local-operator");
    expect(screen.queryByRole("option", { name: /Old/ })).toBeNull();
  });

  it("stays blocked until id, a path and a type are given, saying which is missing", async () => {
    show(harness().fetchImpl);
    expect(screen.getByText("An id is required.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Id"), "ART-9");
    expect(screen.getByText("At least one path is required.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Paths, one per line"), "docs/x.md");
    expect(screen.getByText("Type is required.")).toBeTruthy();
  });

  it("registers with joined paths and split ids, then hands back the id", async () => {
    const { sent, fetchImpl } = harness();
    const { onCreated } = show(fetchImpl);
    await userEvent.type(screen.getByLabelText("Id"), "ART-9");
    await userEvent.type(screen.getByLabelText("Paths, one per line"), "docs/x.md{enter}docs/y.md");
    await userEvent.type(screen.getByLabelText("Type"), "document");
    await userEvent.type(screen.getByLabelText("Related tasks"), "T-1, T-2");
    await userEvent.click(screen.getByRole("button", { name: "Register artifact" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("ART-9"));
    expect(sent[0]).toEqual({
      id: "ART-9",
      uri: "docs/x.md, docs/y.md",
      owner: "local-operator",
      type: "document",
      status: "draft",
      tasks: ["T-1", "T-2"],
    });
  });
});
