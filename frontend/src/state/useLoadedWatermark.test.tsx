/**
 * The audit watermark read when a ruling form opens (UI-87): taken only when
 * the newest audit id holds across the record read and the record read
 * matches what is shown.
 */

import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "./AppContext.tsx";
import { IdentityStore } from "./identityStore.ts";
import { sameRecord, useLoadedWatermark } from "./useLoadedWatermark.ts";

const SHOWN = { id: "ART-1", status: "draft", uri: "docs/a.md", updated_at: "2026-11-10T00:00:00+00:00" };

function harness(heads: number[], record: Record<string, unknown>) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.includes("/api/audit")
      ? [{ id: heads.length > 1 ? heads.shift()! : heads[0]! }]
      : record;
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProvider store={new IdentityStore(null)} client={new ApiClient(() => null, "", fetchImpl)}>
      {children}
    </AppProvider>
  );
  return { fetchImpl, wrapper };
}

describe("useLoadedWatermark", () => {
  it("takes the newest audit id when it holds across the read", async () => {
    const { wrapper } = harness([10, 10], { ...SHOWN, reviewers: [] });
    const { result } = renderHook(() => useLoadedWatermark("artifact", "artifacts", SHOWN), { wrapper });
    await waitFor(() => expect(result.current).toBe(10));
  });

  it("reads again when a write lands between the two audit reads", async () => {
    const { wrapper, fetchImpl } = harness([10, 11, 11, 11], SHOWN);
    const { result } = renderHook(() => useLoadedWatermark("artifact", "artifacts", SHOWN), { wrapper });
    await waitFor(() => expect(result.current).toBe(11));
    expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes("/api/audit"))).toHaveLength(4);
  });

  it("gives nothing when the record changed after it was shown", async () => {
    const { wrapper, fetchImpl } = harness([12, 12], { ...SHOWN, uri: "docs/b.md" });
    const { result } = renderHook(() => useLoadedWatermark("artifact", "artifacts", SHOWN), { wrapper });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current).toBeUndefined();
  });

  it("compares only the fields both reads carry", () => {
    expect(sameRecord(SHOWN, { ...SHOWN, reviewers: ["jade"] })).toBe(true);
    expect(sameRecord(SHOWN, { ...SHOWN, status: "review" })).toBe(false);
  });
});
