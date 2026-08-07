/**
 * Which slice of the queue the operator sees by default.
 *
 * 70% of a mature board is done, and the CLI's priority-then-updated order put
 * ten done rows on the first page — so the console opened on nothing that
 * needed anyone (UI-37). The default is now open work.
 *
 * Persisted, like the theme and the page size, per Michael's ruling: a fixed
 * default with a toggle loses the setting on every reload, which is a small
 * tax paid forever by the operator who always wants the same view. Local-only;
 * it is a display choice, not coordination state.
 *
 * Deliberately the same control as the status filter rather than a second
 * switch beside it. Two independent controls can contradict each other — scope
 * "open" with status "done" shows an empty table for no stated reason — and a
 * persisted filter the operator cannot see is how someone concludes a task has
 * vanished. One always-visible select cannot disagree with itself.
 */

import { TASK_STATUSES, type TaskStatus } from "../api/contract.ts";
import type { StorageLike } from "./identityStore.ts";

/** Everything not done. Not expressible as a single CLI status filter. */
export const OPEN_SCOPE = "open";
/** No status filter at all. */
export const ALL_SCOPE = "all";

export type QueueScope = typeof OPEN_SCOPE | typeof ALL_SCOPE | TaskStatus;

export const DEFAULT_SCOPE: QueueScope = OPEN_SCOPE;

export const SCOPE_LABELS: Record<string, string> = {
  [OPEN_SCOPE]: "Open work",
  [ALL_SCOPE]: "All states",
};

const STORAGE_KEY = "coordination-console.queueScope";

export function isQueueScope(value: unknown): value is QueueScope {
  if (typeof value !== "string") return false;
  if (value === OPEN_SCOPE || value === ALL_SCOPE) return true;
  return (TASK_STATUSES as readonly string[]).includes(value);
}

/** True when the scope names one status the CLI can filter on server-side. */
export function isServerStatus(scope: QueueScope): scope is TaskStatus {
  return scope !== OPEN_SCOPE && scope !== ALL_SCOPE;
}

/**
 * The status to send to the CLI, or undefined to load the unfiltered window.
 *
 * "Open work" has no server-side spelling — `task list` takes one status at a
 * time and cannot express everything-not-done — so it loads the window and
 * narrows it in the browser, which is the same loaded-rows contract the filter
 * box already uses.
 */
export function requestStatus(scope: QueueScope): TaskStatus | undefined {
  return isServerStatus(scope) ? scope : undefined;
}

/** Narrow already-loaded rows for the scopes the server could not apply. */
export function scopeRows<T extends { status: string }>(
  rows: readonly T[],
  scope: QueueScope,
): T[] {
  if (scope !== OPEN_SCOPE) return [...rows];
  return rows.filter((row) => row.status !== "done");
}

export class QueueScopeStore {
  constructor(private readonly storage: StorageLike | null) {}

  load(): QueueScope {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      // A status that no longer exists is dropped rather than honoured, so
      // retiring one cannot strand an operator on an empty queue.
      return isQueueScope(raw) ? raw : DEFAULT_SCOPE;
    } catch {
      return DEFAULT_SCOPE;
    }
  }

  save(scope: QueueScope): void {
    if (!isQueueScope(scope)) return;
    try {
      this.storage?.setItem(STORAGE_KEY, scope);
    } catch {
      // A quota failure must not stop the queue from re-filtering.
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

export function browserQueueScopeStore(): QueueScopeStore {
  try {
    return new QueueScopeStore(globalThis.localStorage ?? null);
  } catch {
    return new QueueScopeStore(null);
  }
}
