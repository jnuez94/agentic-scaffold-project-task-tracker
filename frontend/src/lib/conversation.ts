/**
 * Grouping loaded messages into a chronological transcript.
 *
 * Order is ascending `created_at` then `id` (UI-11 criterion 3), so the
 * transcript reads top to bottom and new messages append at the end. The
 * selected mock shows newest-first, but the criteria take precedence over the
 * mock, and criterion 11 — do not pull the operator away from earlier messages
 * unless they were near the bottom — only makes sense for an ascending stream.
 *
 * Ties on `created_at` are broken by `id`, because the contract stores
 * timestamps at one-second resolution and two messages can share one.
 */

import type { Message } from "../api/contract.ts";

export interface DayGroup {
  /** Stable local calendar key, e.g. "2026-07-26". */
  key: string;
  label: string;
  messages: Message[];
}

export function sortChronologically(messages: readonly Message[]): Message[] {
  return [...messages].sort((left, right) => {
    if (left.created_at === right.created_at) return left.id.localeCompare(right.id);
    return left.created_at < right.created_at ? -1 : 1;
  });
}

/** Local calendar day key. Grouping follows the operator's clock, not UTC. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const key = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate.toISOString());

  const full = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  if (key === today) return `Today · ${full}`;
  if (key === yesterday) return `Yesterday · ${full}`;
  return full;
}

/** Chronological groups, each already in ascending order. */
export function groupByDay(messages: readonly Message[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();

  for (const message of sortChronologically(messages)) {
    const key = dayKey(message.created_at);
    let group = index.get(key);
    if (!group) {
      group = { key, label: dayLabel(message.created_at, now), messages: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.messages.push(message);
  }
  return groups;
}

/** Whether a message was written by the actor the operator is currently acting as. */
export function isOwnMessage(message: Message, actorId: string | null): boolean {
  return Boolean(actorId) && message.sender_id === actorId;
}

/**
 * Honest count copy.
 *
 * Never says "all" or implies a server-side total: `message list` returns a
 * page with no total, so only the loaded number is knowable.
 */
export function loadedCountLabel(count: number, filtered: boolean): string {
  const noun = count === 1 ? "message" : "messages";
  return filtered ? `${count} ${noun} loaded (filtered)` : `${count} ${noun} loaded`;
}
