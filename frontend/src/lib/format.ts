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

/** "14m ago", "3h ago", "2d ago" — or an absolute date beyond a week. */
export function relativeTime(value: string | null | undefined, now: Date = new Date()): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return "—";
  const seconds = Math.round((now.getTime() - parsed.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < 7 * DAY) return `${Math.floor(seconds / DAY)}d ago`;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

/** Local date only. */
export function shortDate(value: string | null | undefined): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Collapse whitespace and clip, for one-line previews of long stored text. */
export function preview(text: string, limit = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1)}…`;
}
