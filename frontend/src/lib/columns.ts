/**
 * Dropping columns that hold width without holding information.
 *
 * A column can be correct and still be worthless: the task queue's "Next
 * action" renders an em-dash for every done task, and 70% of a mature board is
 * done, so it reserves permanent width to display a row of dashes (UI-44).
 * Sessions' "Recovery" column has the same shape for the opposite reason — its
 * predicate is right, and the answer is legitimately "no" on every row (UI-40).
 *
 * The rule is deliberately narrow: a column opts in by declaring `vacantFor`,
 * and it is dropped only when *every* row in view is vacant. A column that is
 * empty on some rows still earns its place, because the contrast between the
 * filled and empty cells is the information.
 */

export interface VacantAware<T> {
  /**
   * True when this row contributes nothing to this column.
   *
   * Declaring it is what opts a column into being dropped; columns without it
   * are always kept, which is the right default for a column whose emptiness
   * is itself meaningful.
   */
  vacantFor?: (row: T) => boolean;
}

/**
 * The columns worth rendering for `rows`.
 *
 * Evaluated against the whole loaded set rather than the current page, so a
 * column cannot appear and disappear as the operator pages through — a table
 * whose shape changes under paging is harder to read than one dead column.
 */
export function withoutVacantColumns<T, C extends VacantAware<T>>(
  columns: readonly C[],
  rows: readonly T[],
): C[] {
  // With nothing loaded there is no evidence either way, and dropping every
  // opted-in column would make an empty table disagree with a populated one.
  if (rows.length === 0) return [...columns];
  return columns.filter((column) => {
    const vacantFor = column.vacantFor;
    if (!vacantFor) return true;
    return rows.some((row) => !vacantFor(row));
  });
}
