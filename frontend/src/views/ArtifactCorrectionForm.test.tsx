import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { ArtifactCorrectionForm } from "./ArtifactCorrectionForm.tsx";

const ARTIFACT = {
  id: "ART-1",
  uri: "docs/plan.md, docs/appendix.md",
  owner_id: "alice",
  type: "document",
  status: "draft",
  usage_boundaries: "Draft only.",
} as Artifact;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function harness(status = 200) {
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/api/artifacts/ART-1/update") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      const payload =
        status === 200
          ? { ok: true, data: { ...ARTIFACT, ...body }, audit_range: [2000, 2000] }
          : { ok: false, error: { code: "status_mismatch", message: "expected draft, found review" } };
      return new Response(JSON.stringify(payload), { status });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function show(fetchImpl: typeof fetch) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <ArtifactCorrectionForm artifact={ARTIFACT} onClose={onClose} onChanged={onChanged} />
    </AppProvider>,
  );
  return { onClose, onChanged };
}

describe("ArtifactCorrectionForm", () => {
  it("opens with the record's paths one per line and refuses to submit nothing", async () => {
    show(harness().fetchImpl);
    expect(screen.getByLabelText<HTMLTextAreaElement>("Paths, one per line").value).toBe("docs/plan.md\ndocs/appendix.md");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Correct record" }).disabled).toBe(true);
    expect(screen.getByText("Nothing has changed.")).toBeTruthy();
  });

  it("sends only the changed fields with the loaded status as the guard, then announces", async () => {
    const { sent, fetchImpl } = harness();
    const { onChanged, onClose } = show(fetchImpl);

    await userEvent.clear(screen.getByLabelText("Type"));
    await userEvent.type(screen.getByLabelText("Type"), "spec");
    await userEvent.click(screen.getByRole("button", { name: "Correct record" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(sent[0]).toEqual({ actor: "local-operator", if_status: "draft", type: "spec" });
    expect(onClose).toHaveBeenCalled();
  });

  it("names the artifact when it moved underneath, and keeps the draft", async () => {
    show(harness(409).fetchImpl);
    await userEvent.clear(screen.getByLabelText("Type"));
    await userEvent.type(screen.getByLabelText("Type"), "spec");
    await userEvent.click(screen.getByRole("button", { name: "Correct record" }));

    await screen.findByText("This artifact changed while you were looking. Reload latest; your draft will be preserved.");
    expect(screen.getByLabelText<HTMLInputElement>("Type").value).toBe("spec");
  });
});
