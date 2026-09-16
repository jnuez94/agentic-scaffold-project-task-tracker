/**
 * Health's informational group (UI-65).
 *
 * Since 1.4.0 the health report has two kinds of section. Anomalies describe
 * decay and decide the healthy flag. Informational sections describe normal
 * workflow worth surfacing — tasks awaiting review, today — and never make a
 * project unhealthy. The view renders the two differently on purpose, and this
 * module decides what belongs in the quiet group and in what order.
 */

import type { Health, Task, TaskListRow } from "../api/contract.ts";
import { humanize } from "./labels.ts";

export interface InformationalSection {
  key: string;
  title: string;
  rows: unknown[];
  truncated: boolean;
}

const TITLES: Record<string, string> = { tasks_awaiting_review: "Awaiting review" };

/**
 * Every non-empty informational section, titled. A key this console has never
 * seen renders under a humanised title rather than being dropped, so the next
 * package addition needs no console change to be visible.
 */
export function informationalSections(
  health: Pick<Health, "informational" | "truncated_sections">,
): InformationalSection[] {
  return Object.entries(health.informational ?? {})
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([key, rows]) => ({
      key,
      title: TITLES[key] ?? humanize(key),
      rows: key === "tasks_awaiting_review" ? longestWaitingFirst(rows as Task[]) : rows,
      truncated: health.truncated_sections.includes(key),
    }));
}

/**
 * Oldest last update first. The payload carries no timestamp for when a task
 * entered review, so its last update is the honest proxy for how long it has
 * sat — and the view labels it as "updated", not "waiting".
 */
export function longestWaitingFirst(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id),
  );
}

/**
 * Who is implementing: the claim holder, else the assignees, else nothing.
 * Health's task rows carry no aggregates, so this joins against the task list
 * the view already loads; a task outside that window simply has no name.
 */
export function implementerOf(taskId: string, tasks: readonly TaskListRow[]): string | null {
  const row = tasks.find((task) => task.id === taskId);
  if (!row) return null;
  if (row.claimed_by) return row.claimed_by;
  return row.assignees.length > 0 ? row.assignees.join(", ") : null;
}
