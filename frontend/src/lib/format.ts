/**
 * Timestamp formatting.
 *
 * The contract stores UTC ISO 8601 at one-second resolution. The console shows
 * local time because an operator reads it against their own clock, and keeps
 * the exact stored value in a title attribute for diagnostics.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * "14m ago", "3h ago", "11d ago" — relative at every age, with no fallback.
 *
 * There was a seven-day cutoff here that returned an absolute date beyond it.
 * Measured against the live board it fired for 66 of 80 records, so 82% of
 * rows rendered "Jul 25, 2026" — which wraps to two lines in a 92px column and
 * makes every row read the same on a board where everything happened within
 * days of everything else (UI-46).
 *
 * "11d ago" is both shorter and more informative than the date it replaced.
 * A cutoff may earn its place at months, once there is a board old enough to
 * measure one against; it should not be assumed before then. Absolute time
 * stays on the cell's title attribute and in the inspectors.
 */
export function relativeTime(value: string | null | undefined, now: Date = new Date()): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return "—";
  const seconds = Math.round((now.getTime() - parsed.getTime()) / 1000);
  // A clock skew between the CLI's host and the browser can date a record in
  // the future; "just now" is the honest reading, not a negative age.
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  return `${Math.floor(seconds / DAY)}d ago`;
}

/** Local date and time, for cells where the exact moment matters. */
export function absoluteTime(value: string | null | undefined): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return "—";
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Collapse whitespace and clip, for one-line previews of long stored text. */
export function preview(text: string, limit = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1)}…`;
}
