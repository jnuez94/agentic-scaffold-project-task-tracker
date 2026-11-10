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
/** A ceiling on a full read: 50,000 rows. */
const MAX_ROWS = 50_000;
/**
 * The pages that takes. Each page after the first repeats one row, so it adds
 * one fewer than its size.
 */
const MAX_PAGES = 1 + Math.ceil((MAX_ROWS - SIDE_LIST_LIMIT) / (SIDE_LIST_LIMIT - 1));

/** A full read restarts at most this many times when the set keeps moving. */
const ATTEMPTS = 3;

/** The set changed under every attempt, so no complete read could be made. */
export class ListMoving extends Error {
  constructor() {
    super("The list kept changing while it was read. Try again.");
  }
}

/** The set is longer than a full read goes, so it was not read whole. */
export class ListTooLong extends Error {
  constructor() {
    super(`The list holds more than ${MAX_ROWS} rows, so it was not read whole.`);
  }
}

/**
 * Every row a filtered list holds, read page by page in id order until a page
 * comes back short. For checks that must see the whole set: a claim or an
 * assignment on the one task past the first page is exactly the one that
 * matters (a recovery that says "no claimed tasks" and then blocks one).
 *
 * Pages go by offset, and offsets move when a row joins or leaves the set
 * between page reads: a task done after page one shifts the rest up, and the
 * row at the boundary would be skipped. So each page after the first starts
 * one row early, on the last row already read. If that row is still there,
 * nothing before it moved; if not, the read starts again (UI-88). A set that
 * moves under every attempt is refused rather than returned incomplete, and
 * so is one that is still going at the ceiling.
 */
export async function readAll<T extends { id: string }>(
  page: (query: { order_by: string; limit: number; offset: number }) => Promise<T[]>,
): Promise<T[]> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const rows = await readOnce(page);
    if (rows) return rows;
  }
  throw new ListMoving();
}

async function readOnce<T extends { id: string }>(
  page: (query: { order_by: string; limit: number; offset: number }) => Promise<T[]>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const last = rows[rows.length - 1];
    const batch = await page({ order_by: "id:asc", limit: SIDE_LIST_LIMIT, offset: last ? rows.length - 1 : 0 });
    if (last) {
      if (batch[0]?.id !== last.id) return null;
      rows.push(...batch.slice(1));
    } else {
      rows.push(...batch);
    }
    if (batch.length < SIDE_LIST_LIMIT) return rows;
  }
  // Every page came back full: more rows remain than were read.
  throw new ListTooLong();
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
