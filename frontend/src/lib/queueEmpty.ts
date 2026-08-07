/**
 * What the task queue says when it has nothing to show.
 *
 * This is the surface where UI-37's persisted default could do harm. The queue
 * now remembers "Open work", so an operator can arrive at an empty table whose
 * emptiness is caused by a choice they made weeks ago. "No tasks match these
 * filters" is true and useless there — it names no filter and offers no way
 * back, which is how someone concludes a task has vanished.
 *
 * So the scope gets said out loud, and the way out is named.
 */

import { OPEN_SCOPE, type QueueScope } from "../state/queueScopeStore.ts";

export interface EmptyCopy {
  title: string;
  hint: string;
}

export function queueEmptyState(options: {
  scope: QueueScope;
  /** Whether a text filter is currently narrowing the loaded rows. */
  filtered: boolean;
  /** Whether an assignee filter is applied. */
  byAssignee: boolean;
  /** Rows loaded before the scope narrowed them. */
  loadedCount: number;
}): EmptyCopy {
  const { scope, filtered, byAssignee, loadedCount } = options;

  // The case worth spelling out: rows did load, and the remembered scope is
  // the only reason none of them are on screen.
  if (scope === OPEN_SCOPE && loadedCount > 0 && !filtered && !byAssignee) {
    return {
      title: "No open work",
      hint: `All ${loadedCount} loaded task${loadedCount === 1 ? " is" : "s are"} done. Choose “All states” to see them.`,
    };
  }

  if (filtered || byAssignee) {
    return {
      title: "No tasks match these filters",
      hint: "Clear the filters to see the full queue.",
    };
  }

  if (scope !== OPEN_SCOPE && scope !== "all") {
    return {
      title: `No tasks are ${scope}`,
      hint: "Choose another state to see the rest of the queue.",
    };
  }

  return {
    title: "No tasks yet",
    hint: "Create one with the coordination CLI, then refresh.",
  };
}
