import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Artifact } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { stamp } from "../lib/auditWatermark.ts";
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

function harness(status = 200, history: unknown[] = []) {
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
    return new Response(JSON.stringify({ ok: true, data: path.includes("/api/audit") ? history : [] }), { status: 200 });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function show(fetchImpl: typeof fetch, artifact: Artifact = ARTIFACT) {
  const store = new IdentityStore(memoryStorage());
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <ArtifactCorrectionForm artifact={artifact} onClose={onClose} onChanged={onChanged} />
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

  describe("Since you loaded it, on a form opened over a stale row (UI-88)", () => {
    // The correction (audit 10) was already in the row when it loaded, but the
    // CLI stamped its audit row a second after the row's updated_at. Another
    // operator then moved the status (audit 11) before this form opened.
    const entry = (id: number, action: string, detail: string, created_at: string) => ({
      id, actor: "greg", session_id: "s-1", action, object_type: "artifact", object_id: "ART-1", detail, created_at,
    });
    const history = [
      entry(11, "status", "draft -> review", "2026-11-10T00:00:05+00:00"),
      entry(10, "update", "fields=type", "2026-11-10T00:00:01+00:00"),
    ];
    const loaded = { ...ARTIFACT, updated_at: "2026-11-10T00:00:00+00:00" };
    const refuse = async () => {
      await userEvent.clear(screen.getByLabelText("Type"));
      await userEvent.type(screen.getByLabelText("Type"), "spec");
      await userEvent.click(screen.getByRole("button", { name: "Correct record" }));
      await screen.findByText("Since you loaded it");
    };

    it("lists only what followed the audit position the row was read at", async () => {
      show(harness(409, history).fetchImpl, stamp({ ...loaded }, 10));
      await refuse();
      expect(screen.getByText(/Status: draft -> review/)).toBeTruthy();
      expect(screen.queryByText(/Edited: Type/)).toBeNull();
      expect(screen.queryByText(/You were editing/)).toBeNull();
    });

    it("claims no collision when the row carries no audit position", async () => {
      show(harness(409, history).fetchImpl, loaded);
      await refuse();
      expect(screen.getByText(/Status: draft -> review/)).toBeTruthy();
      expect(screen.queryByText(/You were editing/)).toBeNull();
    });
  });
});
