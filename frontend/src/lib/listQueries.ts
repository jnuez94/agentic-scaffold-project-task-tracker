/**
 * The queries a side list uses when a check needs part of a list, not a page
 * of it (UI-86).
 *
 * The CLI lists oldest first and caps a page at 500 rows. A check that looked
 * through one page answered for those rows only: the header lost the
 * console's own session, and claims, assignments and follow-ups past the page
 * went unseen. A check that must be complete reads every page of the rows it
 * can involve (open tasks, active sessions); a picker or a suggestion reads
 * the newest page.
 */

import type { Coordination } from "../api/coordination.ts";
import { OPEN_SCOPE, requestStatus } from "../state/queueScopeStore.ts";

export const SIDE_LIST_LIMIT = 500;
/** A ceiling on a full read: 100 pages, 50,000 rows. */
const MAX_PAGES = 100;

/**
 * Every row a filtered list holds, read page by page in id order until a page
 * comes back short. For checks that must see the whole set: a claim or an
 * assignment on the one task past the first page is exactly the one that
 * matters (a recovery that says "no claimed tasks" and then blocks one).
 * Id order is stable, and repeats from rows moving between pages are dropped.
 */
export async function readAll<T extends { id: string }>(
  page: (query: { order_by: string; limit: number; offset: number }) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const batch = await page({ order_by: "id:asc", limit: SIDE_LIST_LIMIT, offset: index * SIDE_LIST_LIMIT });
    for (const row of batch) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        rows.push(row);
      }
    }
    if (batch.length < SIDE_LIST_LIMIT) break;
  }
  return rows;
}

/**
 * Every task not yet done. Claims, outstanding assignments and follow-up work
 * are only ever on these, and the checks that use them must see all of them.
 */
export const openTasks = (coordination: Coordination) =>
  readAll((page) => coordination.tasks({ status: requestStatus(OPEN_SCOPE), ...page }));

/** Every active session: the ones a guard or a selector can mean. */
export const activeSessions = (coordination: Coordination) =>
  readAll((page) => coordination.sessions({ status: "active", ...page }));

/** Newest first, for every list ordered by creation. */
export const NEWEST_FIRST = "created_at:desc";
