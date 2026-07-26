import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE } from "../lib/pagination.ts";
import type { StorageLike } from "./identityStore.ts";
import { isPageSize, PageSizeStore } from "./pageSizeStore.ts";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

class BrokenStorage implements StorageLike {
  getItem(): string | null { throw new Error("blocked"); }
  setItem(): void { throw new Error("quota"); }
  removeItem(): void { throw new Error("blocked"); }
}

describe("isPageSize", () => {
  it("accepts only offered sizes", () => {
    for (const size of [10, 25, 50, 100]) expect(isPageSize(size)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [250, 0, -10, 15, "25", null, undefined, {}]) {
      expect(isPageSize(value)).toBe(false);
    }
  });
});

describe("PageSizeStore", () => {
  it("defaults to 10 when nothing is stored", () => {
    expect(new PageSizeStore(new MemoryStorage()).load("tasks")).toBe(10);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it("remembers a choice, so it becomes that table's default", () => {
    const store = new PageSizeStore(new MemoryStorage());
    store.save("tasks", 50);
    expect(store.load("tasks")).toBe(50);
  });

  it("keeps tables independent", () => {
    const store = new PageSizeStore(new MemoryStorage());
    store.save("sessions", 100);
    expect(store.load("sessions")).toBe(100);
    // Dense task rows should not inherit a choice made for one-line sessions.
    expect(store.load("tasks")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("drops a stored size that is no longer offered", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.pageSize", JSON.stringify({ tasks: 250 }));
    expect(new PageSizeStore(storage).load("tasks")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("refuses to persist an invalid size", () => {
    const storage = new MemoryStorage();
    new PageSizeStore(storage).save("tasks", 999 as never);
    expect(storage.getItem("coordination-console.pageSize")).toBeNull();
  });

  it("survives corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.pageSize", "{not json");
    expect(new PageSizeStore(storage).load("tasks")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("survives a non-object payload", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.pageSize", '"nope"');
    expect(new PageSizeStore(storage).load("tasks")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("tolerates storage that throws", () => {
    const store = new PageSizeStore(new BrokenStorage());
    expect(store.load("tasks")).toBe(DEFAULT_PAGE_SIZE);
    expect(() => store.save("tasks", 25)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it("works with no storage at all", () => {
    const store = new PageSizeStore(null);
    expect(store.load("tasks")).toBe(DEFAULT_PAGE_SIZE);
    expect(() => store.save("tasks", 25)).not.toThrow();
  });

  it("preserves other tables when one is updated", () => {
    const store = new PageSizeStore(new MemoryStorage());
    store.save("tasks", 25);
    store.save("messages", 100);
    expect(store.load("tasks")).toBe(25);
    expect(store.load("messages")).toBe(100);
  });
});
