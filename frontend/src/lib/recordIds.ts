/**
 * Ids of the form PREFIX-N: which prefixes a board uses, and the next free
 * number for one. Shared by the task and escalation forms (UI-48, UI-49).
 *
 * The shape is a parameter because the two entities do not agree on it. Task
 * ids are a bare prefix and a number — UI-61, SEC-1. Escalation ids on this
 * board are descriptive, with the number last — ESC-SEC1-OWNER-1,
 * UX-REVIEW-BLOCK-1 — so "the prefix" is everything before the final dash.
 * One helper with a shape beats two helpers that drift.
 *
 * "Next free" is computed from whatever ids the caller has loaded, which is
 * honest up to the request limit and could be stale under a concurrent
 * create. The CLI is the authority on uniqueness; these only make a good
 * first guess and a recoverable refusal.
 */

/** A bare prefix and a number: UI-61. */
export const TASK_ID_SHAPE = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/;
/** Anything, then a final dash and a number: ESC-REL1-OPERATOR-1. */
export const ESCALATION_ID_SHAPE = /^(.+)-(\d+)$/;

/**
 * The schema's id rule, shared by every entity: 1-128 chars, first char
 * alphanumeric, then alphanumerics and `. _ : @ + -`.
 */
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$/;

export function isValidRecordId(id: string): boolean {
  return RECORD_ID.test(id);
}

export interface PrefixUse {
  prefix: string;
  count: number;
  highest: number;
}

/** Prefixes in use, most-used first, with the highest number seen for each. */
export function prefixesInUse(ids: readonly string[], shape: RegExp = TASK_ID_SHAPE): PrefixUse[] {
  const seen = new Map<string, { count: number; highest: number }>();
  for (const id of ids) {
    const match = shape.exec(id);
    if (!match) continue;
    const prefix = match[1]!;
    const number = Number(match[2]);
    const entry = seen.get(prefix) ?? { count: 0, highest: 0 };
    entry.count += 1;
    entry.highest = Math.max(entry.highest, number);
    seen.set(prefix, entry);
  }
  return [...seen.entries()]
    .map(([prefix, entry]) => ({ prefix, ...entry }))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
}

/** One past the highest seen for the prefix; `PREFIX-1` for a new prefix. */
export function nextFreeId(
  prefix: string,
  ids: readonly string[],
  shape: RegExp = TASK_ID_SHAPE,
): string {
  const found = prefixesInUse(ids, shape).find((entry) => entry.prefix === prefix);
  return `${prefix}-${(found?.highest ?? 0) + 1}`;
}

/** The prefix of an id under the shape, or null when it does not match. */
export function prefixOf(id: string, shape: RegExp = TASK_ID_SHAPE): string | null {
  return shape.exec(id)?.[1] ?? null;
}
