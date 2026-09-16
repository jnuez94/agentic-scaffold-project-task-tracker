/**
 * The one aggregate an operator wants from `summary` (UI-55): how long open
 * work has sat where it is. `time_in_state` covers every status but done with
 * a count, the oldest and the average in whole seconds, derived from each
 * task's last status-changing audit row. Rendered as one quiet line, not a
 * dashboard: "In review: 18, oldest 51 days".
 */

import type { Summary } from "../api/contract.ts";
import { taskStatus } from "./labels.ts";

const ORDER = ["todo", "in_progress", "review", "blocked"] as const;

/** Whole units, rounded down, in the largest unit that fits: minutes, hours, days. */
export function formatAge(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "" when nothing is open, or the section was not fetched. */
export function timeInStateLine(timeInState: Summary["time_in_state"] | undefined): string {
  if (!timeInState) return "";
  return ORDER.filter((status) => (timeInState[status]?.count ?? 0) > 0)
    .map((status) => {
      const entry = timeInState[status]!;
      return `${taskStatus(status).label}: ${entry.count}, oldest ${formatAge(entry.oldest_seconds)}`;
    })
    .join(" · ");
}
