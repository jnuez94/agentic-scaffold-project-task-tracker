import { describe, expect, it } from "vitest";
import type { StorageLike } from "./identityStore.ts";
import {
  applyTheme,
  DEFAULT_THEME,
  isTheme,
  THEMES,
  ThemePreferenceStore,
} from "./themePreference.ts";

function storage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
}

describe("ThemePreferenceStore", () => {
  it("defaults to stock Flowline", () => {
    expect(new ThemePreferenceStore(storage()).load()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("flowline");
  });

  it("round-trips every known theme", () => {
    for (const theme of THEMES) {
      const store = new ThemePreferenceStore(storage());
      store.save(theme);
      expect(store.load()).toBe(theme);
    }
  });

  // Storage is operator-editable and survives upgrades that drop a theme.
  it("falls back rather than trusting an unknown stored value", () => {
    const store = new ThemePreferenceStore(
      storage({ "coordination-console.theme": "vaporwave" }),
    );
    expect(store.load()).toBe(DEFAULT_THEME);
  });

  it("survives storage that throws, in both directions", () => {
    const store = new ThemePreferenceStore(throwingStorage());
    expect(store.load()).toBe(DEFAULT_THEME);
    expect(() => store.save("blueprint")).not.toThrow();
  });

  it("survives having no storage at all", () => {
    const store = new ThemePreferenceStore(null);
    expect(store.load()).toBe(DEFAULT_THEME);
    expect(() => store.save("paper")).not.toThrow();
  });
});

describe("isTheme", () => {
  it("accepts the known themes and rejects anything else", () => {
    expect(isTheme("paper")).toBe(true);
    expect(isTheme("blueprint")).toBe(true);
    expect(isTheme("flowline")).toBe(true);
    expect(isTheme("")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(42)).toBe(false);
  });
});

describe("applyTheme", () => {
  it("sets data-theme for a non-default theme", () => {
    const root = document.createElement("html");
    applyTheme("blueprint", root);
    expect(root.getAttribute("data-theme")).toBe("blueprint");
  });

  // Stock Flowline is the plain case: no attribute, so the themed selectors
  // never have to compete with a no-op rule.
  it("removes the attribute for the default theme", () => {
    const root = document.createElement("html");
    applyTheme("paper", root);
    applyTheme("flowline", root);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});
