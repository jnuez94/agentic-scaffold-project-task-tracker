/**
 * The audit position a record was read at, kept with the record itself, for
 * "Since you loaded it" (UI-88).
 *
 * The ledger's head is read just before each read of records. Every audit row
 * up to it was committed before the records were read, so the rows the
 * operator sees reflect it: only rows after it can be changes since. No clock
 * is involved; the CLI stamps a record's `updated_at` before its write lock
 * and the audit row after, so the two can fall in different seconds.
 *
 * UI-87 read the position when a form opened, and lost it whenever the record
 * had changed since it was shown, falling back to the clock. Reading it with
 * the rows means a form opened on a stale row still has the position of what
 * was shown.
 *
 * The mark is kept beside the row object, not in it, so rows stay the CLI's
 * rows. A row with no mark (its head read failed) falls back to the clock.
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

/** Reads the ledger head, then the records; marks each record with the head. */
export async function readMarked<T extends object>(
  coordination: Coordination,
  read: () => Promise<T[]>,
): Promise<T[]> {
  const head = await coordination
    .summary({ section: "totals" })
    .then((summary) => summary.audit_cursor)
    .catch(() => undefined);
  const rows = await read();
  for (const row of rows) stamp(row, head);
  return rows;
}

/** The same, for one record read by id. */
export async function readOneMarked<T extends object>(coordination: Coordination, read: () => Promise<T>): Promise<T> {
  const [row] = await readMarked(coordination, () => read().then((one) => [one]));
  return row!;
}
