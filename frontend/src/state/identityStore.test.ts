import { describe, expect, it } from "vitest";
import { EMPTY_IDENTITY, IdentityStore, type StorageLike } from "./identityStore.ts";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

class BrokenStorage implements StorageLike {
  getItem(): string | null {
    throw new Error("blocked");
  }
  setItem(): void {
    throw new Error("quota");
  }
  removeItem(): void {
    throw new Error("blocked");
  }
}

describe("IdentityStore", () => {
  it("returns an empty identity when nothing is stored", () => {
    expect(new IdentityStore(new MemoryStorage()).load()).toEqual(EMPTY_IDENTITY);
  });

  it("round-trips an identity", () => {
    const store = new IdentityStore(new MemoryStorage());
    store.save({ actorId: "david", sessionId: "s-1" });
    expect(store.load()).toEqual({ actorId: "david", sessionId: "s-1" });
  });

  it("survives a corrupt entry rather than blocking startup", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.identity", "{not json");
    expect(new IdentityStore(storage).load()).toEqual(EMPTY_IDENTITY);
  });

  it("normalizes unexpected shapes", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.identity", JSON.stringify({ actorId: 5 }));
    expect(new IdentityStore(storage).load()).toEqual(EMPTY_IDENTITY);
  });

  it("treats empty strings as absent", () => {
    expect(IdentityStore.normalize({ actorId: "", sessionId: "" })).toEqual(EMPTY_IDENTITY);
  });

  it("tolerates storage that throws", () => {
    const store = new IdentityStore(new BrokenStorage());
    expect(store.load()).toEqual(EMPTY_IDENTITY);
    expect(() => store.save({ actorId: "a", sessionId: "b" })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it("works with no storage at all", () => {
    const store = new IdentityStore(null);
    expect(store.load()).toEqual(EMPTY_IDENTITY);
    expect(() => store.save({ actorId: "a", sessionId: null })).not.toThrow();
  });

  it("clears a stored identity", () => {
    const storage = new MemoryStorage();
    const store = new IdentityStore(storage);
    store.save({ actorId: "david", sessionId: "s-1" });
    store.clear();
    expect(store.load()).toEqual(EMPTY_IDENTITY);
  });
});
