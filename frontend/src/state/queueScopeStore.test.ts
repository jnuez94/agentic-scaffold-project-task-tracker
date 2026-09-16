import { describe, expect, it } from "vitest";
import {
  ALL_SCOPE,
  DEFAULT_SCOPE,
  isQueueScope,
  OPEN_SCOPE,
  QueueScopeStore,
  requestStatus,
} from "./queueScopeStore.ts";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}


describe("queue scope", () => {
  it("defaults to open work, which is the whole point of UI-37", () => {
    expect(DEFAULT_SCOPE).toBe(OPEN_SCOPE);
  });

  it("accepts the two synthetic scopes and every real status", () => {
    expect(isQueueScope(OPEN_SCOPE)).toBe(true);
    expect(isQueueScope(ALL_SCOPE)).toBe(true);
    expect(isQueueScope("blocked")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isQueueScope("archived")).toBe(false);
    expect(isQueueScope(3)).toBe(false);
    expect(isQueueScope(null)).toBe(false);
  });
});

describe("requestStatus", () => {
  it("sends one status for a status scope", () => {
    expect(requestStatus("blocked")).toEqual(["blocked"]);
  });

  it("spells open work as every status but done, in one request", () => {
    expect(requestStatus(OPEN_SCOPE)).toEqual(["todo", "in_progress", "review", "blocked"]);
  });

  it("sends nothing for all states", () => {
    expect(requestStatus(ALL_SCOPE)).toEqual([]);
  });
});

describe("QueueScopeStore", () => {
  it("round-trips a scope", () => {
    const store = new QueueScopeStore(new MemoryStorage());
    store.save("blocked");
    expect(store.load()).toBe("blocked");
  });

  it("falls back to the default when nothing is stored", () => {
    expect(new QueueScopeStore(new MemoryStorage()).load()).toBe(DEFAULT_SCOPE);
  });

  it("drops a stored value that is no longer a valid scope", () => {
    // Retiring a status must not strand an operator on an empty queue.
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.queueScope", "archived");
    expect(new QueueScopeStore(storage).load()).toBe(DEFAULT_SCOPE);
  });

  it("refuses to persist an invalid scope", () => {
    const store = new QueueScopeStore(new MemoryStorage());
    store.save("nonsense" as never);
    expect(store.load()).toBe(DEFAULT_SCOPE);
  });

  it("survives storage being unavailable", () => {
    // Private browsing and quota failures must not break the queue.
    const store = new QueueScopeStore(null);
    expect(() => store.save(ALL_SCOPE)).not.toThrow();
    expect(store.load()).toBe(DEFAULT_SCOPE);
  });

  it("clears back to the default", () => {
    const store = new QueueScopeStore(new MemoryStorage());
    store.save(ALL_SCOPE);
    store.clear();
    expect(store.load()).toBe(DEFAULT_SCOPE);
  });
});
