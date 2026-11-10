/**
 * The queries a side list uses when it needs part of a list, not a page of
 * it (UI-86).
 *
 * The CLI lists oldest first and caps a page at 500 rows. A check that looked
 * through the first 500 tasks or sessions answered for the oldest ones only:
 * the header lost the console's own session, and claims, assignments and
 * follow-ups on newer tasks went unseen. Each side list now asks for the rows
 * its check can involve, newest first.
 */

import type { Coordination } from "../api/coordination.ts";
import { OPEN_SCOPE, requestStatus } from "../state/queueScopeStore.ts";

export const SIDE_LIST_LIMIT = 500;

/**
 * Tasks not yet done, most recently changed first. Claims, outstanding
 * assignments and blockers are only ever on these.
 */
export const openTasks = (coordination: Coordination) =>
  coordination.tasks({ status: requestStatus(OPEN_SCOPE), order_by: "updated_at:desc", limit: SIDE_LIST_LIMIT });

/** Active sessions only: the ones a guard or a selector can mean. */
export const activeSessions = (coordination: Coordination) =>
  coordination.sessions({ status: "active", order_by: "started_at:desc", limit: SIDE_LIST_LIMIT });

/** Newest first, for every list ordered by creation. */
export const NEWEST_FIRST = "created_at:desc";
