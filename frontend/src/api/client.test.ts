import { describe, expect, it, vi } from "vitest";
import { ApiClient, SESSION_HEADER } from "./client.ts";
import { ApiError } from "./errors.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient.url", () => {
  const client = new ApiClient();

  it("returns the bare path with no query", () => {
    expect(client.url("/api/tasks")).toBe("/api/tasks");
  });

  it("appends provided values", () => {
    expect(client.url("/api/tasks", { status: "todo" })).toBe("/api/tasks?status=todo");
  });

  it("drops undefined, null, and empty values so filters can be optional", () => {
    expect(client.url("/api/tasks", { status: undefined, assignee: null, tag: "" })).toBe(
      "/api/tasks",
    );
  });

  it("encodes values", () => {
    expect(client.url("/api/messages", { recipient: "a b&c" })).toContain("a+b%26c");
  });
});

describe("ApiClient.get", () => {
  it("unwraps the data envelope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: [1, 2] }));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.get("/api/tasks")).resolves.toEqual([1, 2]);
  });

  it("omits the session header when there is no session", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await client.get("/api/meta");
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers[SESSION_HEADER]).toBeUndefined();
  });

  it("sends the session header when one is active", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => "s-1", "", fetchImpl as unknown as typeof fetch);
    await client.get("/api/meta");
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers[SESSION_HEADER]).toBe("s-1");
  });

  it("reads the session at call time, not construction time", async () => {
    let session: string | null = null;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => session, "", fetchImpl as unknown as typeof fetch);
    session = "s-2";
    await client.get("/api/meta");
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers[SESSION_HEADER]).toBe("s-2");
  });

  it("throws an ApiError preserving the stable code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        { ok: false, error: { code: "stale_task_revision", message: "stale", details: { actual_revision: 6 } } },
        409,
      ),
    );
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.get("/api/tasks")).rejects.toMatchObject({
      code: "stale_task_revision",
      status: 409,
    });
  });

  it("reports a non-JSON failure without throwing a parse error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 500 }));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.get("/api/tasks")).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a success payload without data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.get("/api/tasks")).rejects.toMatchObject({ code: "unexpected_response" });
  });
});

describe("ApiClient.post", () => {
  it("sends JSON and the content type the server requires", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: { id: "T-1" } }));
    const client = new ApiClient(() => "s-1", "", fetchImpl as unknown as typeof fetch);
    await client.post("/api/tasks", { id: "T-1" });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ id: "T-1" }));
  });
});

describe("ApiClient.getText", () => {
  it("returns the raw body for the Markdown export", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("# Report", { status: 200 }));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.getText("/api/export")).resolves.toBe("# Report");
  });

  it("throws on failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: false, error: { code: "database_busy", message: "busy" } }, 503));
    const client = new ApiClient(() => null, "", fetchImpl as unknown as typeof fetch);
    await expect(client.getText("/api/export")).rejects.toMatchObject({ code: "database_busy" });
  });
});

describe("ApiClient.withoutSession", () => {
  it("never sends the session header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => "s-1", "", fetchImpl as unknown as typeof fetch);
    await client.withoutSession().post("/api/agents", { id: "local-operator" });
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers[SESSION_HEADER]).toBeUndefined();
  });

  it("keeps the original client sending its session", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => "s-1", "", fetchImpl as unknown as typeof fetch);
    client.withoutSession();
    await client.get("/api/meta");
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers[SESSION_HEADER]).toBe("s-1");
  });

  it("preserves the base URL and fetch implementation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: {} }));
    const client = new ApiClient(() => "s", "/base", fetchImpl as unknown as typeof fetch);
    await client.withoutSession().get("/api/meta");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/base/api/meta");
  });
});
