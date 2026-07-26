/**
 * Plain-language labels.
 *
 * Per the UX spec's content guidance, primary UI uses readable language while
 * the stored value stays visible in diagnostic contexts. Status is never
 * carried by color alone, so every state also has a glyph and a text label.
 */

import type { TaskStatus } from "../api/contract.ts";

export type Tone = "neutral" | "blue" | "amber" | "coral" | "mint" | "violet";

export interface StatusPresentation {
  label: string;
  tone: Tone;
  glyph: string;
}

const TASK_STATUS: Record<TaskStatus, StatusPresentation> = {
  todo: { label: "To do", tone: "neutral", glyph: "○" },
  in_progress: { label: "In progress", tone: "blue", glyph: "▶" },
  review: { label: "In review", tone: "amber", glyph: "⧗" },
  blocked: { label: "Blocked", tone: "coral", glyph: "⊘" },
  done: { label: "Done", tone: "mint", glyph: "✓" },
};

export function taskStatus(status: string): StatusPresentation {
  return TASK_STATUS[status as TaskStatus] ?? { label: status, tone: "neutral", glyph: "•" };
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Highest",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Lowest",
};

const PRIORITY_GLYPHS: Record<number, string> = {
  1: "↑↑",
  2: "↑",
  3: "=",
  4: "↓",
  5: "↓↓",
};

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? `Priority ${priority}`;
}

export function priorityGlyph(priority: number): string {
  return PRIORITY_GLYPHS[priority] ?? "=";
}

const GENERIC_TONES: Record<string, Tone> = {
  // review decisions
  accepted: "mint",
  conditionally_accepted: "amber",
  changes_requested: "amber",
  rejected: "coral",
  // decision + artifact statuses
  proposed: "blue",
  superseded: "neutral",
  draft: "neutral",
  // escalation statuses
  open: "coral",
  in_review: "amber",
  resolved: "mint",
  closed_no_action: "neutral",
  // agent + session statuses
  active: "mint",
  inactive: "neutral",
  ended: "neutral",
};

export function toneFor(value: string): Tone {
  return GENERIC_TONES[value] ?? "neutral";
}

/** Turn a stored snake_case enum into sentence case for display. */
export function humanize(value: string): string {
  if (!value) return "";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Initials for an agent avatar, derived from the display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${(parts[0] ?? "").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}

/** Split a stored comma-delimited tag string into trimmed, nonempty tags. */
export function splitTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
