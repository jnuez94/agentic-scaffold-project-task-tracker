/**
 * The audit position a record was read at, kept with the record itself, for
 * "Since you loaded it" (UI-88).
 *
 * The ledger's head is read before and after each read of records. When the
 * two agree, nothing was written while the records were read, so the rows the
 * operator sees reflect exactly that head: only rows after it can be changes
 * since. When they differ, a write may or may not be in the rows, so the read
 * is made again. No clock is involved; the CLI stamps a record's `updated_at`
 * before its write lock and the audit row after, so the two can fall in
 * different seconds.
 *
 * UI-87 read the position when a form opened, and lost it whenever the record
 * had changed since it was shown, falling back to the clock. Reading it with
 * the rows means a form opened on a stale row still has the position of what
 * was shown.
 *
 * The mark is kept beside the row object, not in it, so rows stay the CLI's
 * rows. A row with no mark (the head could not be read, or the ledger moved
 * under every attempt) falls back to the clock, and claims no collision.
 */

import type { Coordination } from "../api/coordination.ts";

const marks = new WeakMap<object, number>();

/** The audit head every row in this read reflects, or undefined if unknown. */
export function watermarkOf(row: object): number | undefined {
  return marks.get(row);
}

export function stamp<T extends object>(rows: T, head: number | undefined): T {
  if (head !== undefined) marks.set(rows, head);
  return rows;
}

const ATTEMPTS = 3;

/**
 * Reads the records between two reads of the ledger head, and marks each
 * record with the head when both reads agree. Reads again when they differ.
 */
export async function readMarked<T extends object>(
  coordination: Coordination,
  read: () => Promise<T[]>,
): Promise<T[]> {
  const head = () =>
    coordination
      .summary({ section: "totals" })
      .then((summary) => summary.audit_cursor)
      .catch(() => undefined);
  let rows: T[] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const before = await head();
    rows = await read();
    // No head to compare: the rows stand unmarked.
    if (before === undefined) return rows;
    const after = await head();
    if (after === before) {
      for (const row of rows) stamp(row, before);
      return rows;
    }
  }
  // The ledger moved under every attempt: the latest rows, unmarked.
  return rows;
}

/** The same, for one record read by id. */
export async function readOneMarked<T extends object>(coordination: Coordination, read: () => Promise<T>): Promise<T> {
  const [row] = await readMarked(coordination, () => read().then((one) => [one]));
  return row!;
}
