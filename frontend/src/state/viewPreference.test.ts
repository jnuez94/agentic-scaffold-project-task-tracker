import { describe, expect, it } from "vitest";
import type { StorageLike } from "./identityStore.ts";
import {
  DEFAULT_MESSAGE_VIEW,
  isMessageView,
  ViewPreferenceStore,
} from "./viewPreference.ts";

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

describe("isMessageView", () => {
  it("accepts the two presentations", () => {
    expect(isMessageView("conversation")).toBe(true);
    expect(isMessageView("ledger")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["Conversation", "chat", "", null, 3, {}]) {
      expect(isMessageView(value)).toBe(false);
    }
  });
});

describe("ViewPreferenceStore", () => {
  it("defaults to Conversation", () => {
    expect(new ViewPreferenceStore(new MemoryStorage()).load()).toBe("conversation");
    expect(DEFAULT_MESSAGE_VIEW).toBe("conversation");
  });

  it("round-trips a choice", () => {
    const store = new ViewPreferenceStore(new MemoryStorage());
    store.save("ledger");
    expect(store.load()).toBe("ledger");
  });

  it("falls back safely when storage holds something invalid", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.messageView", "gallery");
    expect(new ViewPreferenceStore(storage).load()).toBe("conversation");
  });

  it("refuses to persist an invalid value", () => {
    const storage = new MemoryStorage();
    const store = new ViewPreferenceStore(storage);
    store.save("gallery" as never);
    expect(storage.getItem("coordination-console.messageView")).toBeNull();
  });

  it("tolerates storage that throws", () => {
    const store = new ViewPreferenceStore(new BrokenStorage());
    expect(store.load()).toBe("conversation");
    expect(() => store.save("ledger")).not.toThrow();
  });

  it("works with no storage at all", () => {
    const store = new ViewPreferenceStore(null);
    expect(store.load()).toBe("conversation");
    expect(() => store.save("ledger")).not.toThrow();
  });
});
