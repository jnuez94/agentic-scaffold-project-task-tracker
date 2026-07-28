/**
 * The visual theme preference.
 *
 * Local-only, like the Messages view preference: it is a display choice, not
 * coordination state, so it never touches the database and is never attributed
 * to an actor. Anything unrecognised in storage falls back to the default
 * rather than throwing.
 *
 * Themes are applied as a `data-theme` attribute on the document element. The
 * console ships one bundled stylesheet under `style-src 'self'`, so a second
 * stylesheet link — the mechanism the theme archive assumed — is not available
 * to us. An attribute selector costs nothing and works offline.
 */

import type { StorageLike } from "./identityStore.ts";

export const THEMES = ["flowline", "paper", "blueprint"] as const;
export type Theme = (typeof THEMES)[number];

/** Stock Flowline is the default and carries no attribute. */
export const DEFAULT_THEME: Theme = "flowline";

export const THEME_LABELS: Record<Theme, string> = {
  flowline: "Flowline",
  paper: "Paper",
  blueprint: "Blueprint",
};

const STORAGE_KEY = "coordination-console.theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export class ThemePreferenceStore {
  constructor(private readonly storage: StorageLike | null) {}

  load(): Theme {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return isTheme(raw) ? raw : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }

  save(theme: Theme): void {
    try {
      if (isTheme(theme)) this.storage?.setItem(STORAGE_KEY, theme);
    } catch {
      // A private-browsing quota failure must not break switching themes.
    }
  }
}

export function browserThemePreferenceStore(): ThemePreferenceStore {
  try {
    return new ThemePreferenceStore(globalThis.localStorage ?? null);
  } catch {
    return new ThemePreferenceStore(null);
  }
}

/**
 * Reflect the theme onto the document.
 *
 * The default removes the attribute rather than setting `data-theme="flowline"`,
 * so stock Flowline is the plain unstyled-by-theme case and the themed
 * selectors never have to compete with a no-op rule.
 */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  if (theme === DEFAULT_THEME) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
