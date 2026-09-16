/**
 * Health's informational group (UI-65).
 *
 * Since 1.4.0 the health report has two kinds of section. Anomalies describe
 * decay and decide the healthy flag. Informational sections describe normal
 * workflow worth surfacing — tasks awaiting review, today — and never make a
 * project unhealthy. The view renders the two differently on purpose, and this
 * module decides what belongs in the quiet group and in what order.
 */

import type { Doctor, Health, OutOfBandEdit, Task, TaskListRow } from "../api/contract.ts";
import { humanize } from "./labels.ts";
import { buildHash, type RouteName } from "../state/useHashRoute.ts";

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

export const OUT_OF_BAND_KEY = "out_of_band_edits";
export const OUT_OF_BAND_TITLE = "Records written outside the runtime";
export const OUT_OF_BAND_RULE =
  "Rows whose last change was not made through the coordination runtime. " +
  "A consistency check between cooperating tools, not a security finding; it never affects the healthy flag.";

/**
 * `doctor`'s record-consistency findings as an informational section, or null
 * when there are none — an empty section is omitted like the package's own.
 */
export function doctorSection(doctor: Doctor | undefined): InformationalSection | null {
  if (!doctor || doctor.record_consistency !== "findings" || doctor.out_of_band_edits.length === 0) {
    return null;
  }
  return {
    key: OUT_OF_BAND_KEY,
    title: OUT_OF_BAND_TITLE,
    rows: doctor.out_of_band_edits,
    truncated: doctor.out_of_band_edits_truncated,
  };
}

// doctor checks the tables that carry updated_at; each has a route since UI-69.
const TABLE_ROUTES: Record<string, RouteName> = {
  tasks: "tasks",
  agents: "agents",
  decisions: "decisions",
  artifacts: "artifacts",
  escalations: "escalations",
};

/** Where a found row can be opened, or null for a table without a route. */
export function outOfBandHref(edit: Pick<OutOfBandEdit, "table" | "id">): string | null {
  const route = TABLE_ROUTES[edit.table];
  return route ? buildHash(route, edit.id) : null;
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
