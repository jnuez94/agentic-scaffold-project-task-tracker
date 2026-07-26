/**
 * Persisted pane widths.
 *
 * The UX spec's 184–208px nav and 440–520px inspector are the *defaults*, not
 * a cage: task titles and evidence URIs are long, and an operator on a wide
 * display should be able to trade queue width for inspector width. The bounds
 * below are wider than the spec's ranges but still stop a pane from being
 * dragged to a width where its content is unusable.
 */

import type { StorageLike } from "./identityStore.ts";

export type Pane = "nav" | "inspector";

export interface LayoutWidths {
  nav: number;
  inspector: number;
}

export const DEFAULT_WIDTHS: LayoutWidths = { nav: 200, inspector: 480 };

export const BOUNDS: Record<Pane, { min: number; max: number }> = {
  nav: { min: 160, max: 420 },
  inspector: { min: 360, max: 920 },
};

const STORAGE_KEY = "coordination-console.layout";

export class LayoutStore {
  constructor(private readonly storage: StorageLike | null) {}

  static clamp(pane: Pane, value: number): number {
    const { min, max } = BOUNDS[pane];
    if (!Number.isFinite(value)) return DEFAULT_WIDTHS[pane];
    return Math.round(Math.min(max, Math.max(min, value)));
  }

  static normalize(value: unknown): LayoutWidths {
    if (!value || typeof value !== "object") return { ...DEFAULT_WIDTHS };
    const record = value as Record<string, unknown>;
    return {
      nav: LayoutStore.readWidth(record["nav"], "nav"),
      inspector: LayoutStore.readWidth(record["inspector"], "inspector"),
    };
  }

  private static readWidth(value: unknown, pane: Pane): number {
    return typeof value === "number"
      ? LayoutStore.clamp(pane, value)
      : DEFAULT_WIDTHS[pane];
  }

  load(): LayoutWidths {
    if (!this.storage) return { ...DEFAULT_WIDTHS };
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_WIDTHS };
      return LayoutStore.normalize(JSON.parse(raw));
    } catch {
      // A corrupt entry must not stop the console from rendering.
      return { ...DEFAULT_WIDTHS };
    }
  }

  save(widths: LayoutWidths): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(LayoutStore.normalize(widths)));
    } catch {
      // Private-browsing quota failures are not worth surfacing.
    }
  }
}

export function browserLayoutStore(): LayoutStore {
  try {
    return new LayoutStore(globalThis.localStorage ?? null);
  } catch {
    return new LayoutStore(null);
  }
}
