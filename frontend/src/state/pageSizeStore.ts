/**
 * Remembered rows-per-page, stored per table.
 *
 * Per table rather than one global setting because the tables are not equally
 * dense: a task row carries an id, a wrapped title, owners, and tags, while a
 * session row is a single line. An operator who wants 100 sessions on screen
 * rarely wants 100 tasks.
 *
 * Local-only, like the pane widths and the Messages view preference: this is a
 * display choice, not coordination state.
 */

import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize } from "../lib/pagination.ts";
import type { StorageLike } from "./identityStore.ts";

const STORAGE_KEY = "coordination-console.pageSize";

export function isPageSize(value: unknown): value is PageSize {
  return typeof value === "number" && (PAGE_SIZES as readonly number[]).includes(value);
}

export class PageSizeStore {
  constructor(private readonly storage: StorageLike | null) {}

  private readAll(): Record<string, PageSize> {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const result: Record<string, PageSize> = {};
      for (const [table, size] of Object.entries(parsed as Record<string, unknown>)) {
        // A size that is no longer offered is dropped rather than honoured,
        // so removing an option cannot strand an operator on it.
        if (isPageSize(size)) result[table] = size;
      }
      return result;
    } catch {
      return {};
    }
  }

  load(tableId: string): PageSize {
    return this.readAll()[tableId] ?? DEFAULT_PAGE_SIZE;
  }

  save(tableId: string, size: PageSize): void {
    if (!isPageSize(size)) return;
    try {
      const all = this.readAll();
      all[tableId] = size;
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // A quota failure must not stop the table from re-paging.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // ignored
    }
  }
}

export function browserPageSizeStore(): PageSizeStore {
  try {
    return new PageSizeStore(globalThis.localStorage ?? null);
  } catch {
    return new PageSizeStore(null);
  }
}
