import { describe, expect, it } from "vitest";
import type { StorageLike } from "./identityStore.ts";
import { BOUNDS, DEFAULT_WIDTHS, LayoutStore } from "./layoutStore.ts";

class MemoryStorage implements StorageLike {
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

describe("LayoutStore.clamp", () => {
  it("keeps a value inside the pane's bounds", () => {
    expect(LayoutStore.clamp("nav", 250)).toBe(250);
    expect(LayoutStore.clamp("inspector", 500)).toBe(500);
  });

  it("clamps below the minimum", () => {
    expect(LayoutStore.clamp("nav", 10)).toBe(BOUNDS.nav.min);
    expect(LayoutStore.clamp("inspector", -400)).toBe(BOUNDS.inspector.min);
  });

  it("clamps above the maximum", () => {
    expect(LayoutStore.clamp("nav", 9999)).toBe(BOUNDS.nav.max);
    expect(LayoutStore.clamp("inspector", 9999)).toBe(BOUNDS.inspector.max);
  });

  it("rounds to whole pixels", () => {
    expect(LayoutStore.clamp("nav", 220.6)).toBe(221);
  });

  it("falls back to the default for NaN and Infinity", () => {
    expect(LayoutStore.clamp("nav", Number.NaN)).toBe(DEFAULT_WIDTHS.nav);
    expect(LayoutStore.clamp("inspector", Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_WIDTHS.inspector,
    );
  });

  it("uses different bounds per pane", () => {
    expect(BOUNDS.nav.max).toBeLessThan(BOUNDS.inspector.max);
  });
});

describe("LayoutStore.normalize", () => {
  it("fills in defaults for missing panes", () => {
    expect(LayoutStore.normalize({ nav: 300 })).toEqual({
      nav: 300,
      inspector: DEFAULT_WIDTHS.inspector,
    });
  });

  it("ignores non-numeric values", () => {
    expect(LayoutStore.normalize({ nav: "300", inspector: null })).toEqual(DEFAULT_WIDTHS);
  });

  it("returns defaults for a non-object", () => {
    expect(LayoutStore.normalize(null)).toEqual(DEFAULT_WIDTHS);
    expect(LayoutStore.normalize("nope")).toEqual(DEFAULT_WIDTHS);
  });

  it("clamps stored values that are out of range", () => {
    expect(LayoutStore.normalize({ nav: 5000, inspector: 1 })).toEqual({
      nav: BOUNDS.nav.max,
      inspector: BOUNDS.inspector.min,
    });
  });
});

describe("LayoutStore persistence", () => {
  it("returns defaults when nothing is stored", () => {
    expect(new LayoutStore(new MemoryStorage()).load()).toEqual(DEFAULT_WIDTHS);
  });

  it("round-trips widths", () => {
    const store = new LayoutStore(new MemoryStorage());
    store.save({ nav: 260, inspector: 640 });
    expect(store.load()).toEqual({ nav: 260, inspector: 640 });
  });

  it("clamps on the way out as well as in", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.layout", JSON.stringify({ nav: 4000, inspector: 4000 }));
    expect(new LayoutStore(storage).load()).toEqual({
      nav: BOUNDS.nav.max,
      inspector: BOUNDS.inspector.max,
    });
  });

  it("survives a corrupt entry", () => {
    const storage = new MemoryStorage();
    storage.setItem("coordination-console.layout", "{not json");
    expect(new LayoutStore(storage).load()).toEqual(DEFAULT_WIDTHS);
  });

  it("tolerates storage that throws", () => {
    const store = new LayoutStore(new BrokenStorage());
    expect(store.load()).toEqual(DEFAULT_WIDTHS);
    expect(() => store.save(DEFAULT_WIDTHS)).not.toThrow();
  });

  it("works with no storage at all", () => {
    const store = new LayoutStore(null);
    expect(store.load()).toEqual(DEFAULT_WIDTHS);
    expect(() => store.save({ nav: 200, inspector: 480 })).not.toThrow();
  });

  it("does not hand out a shared mutable default", () => {
    const store = new LayoutStore(null);
    const first = store.load();
    first.nav = 999;
    expect(store.load().nav).toBe(DEFAULT_WIDTHS.nav);
  });
});
