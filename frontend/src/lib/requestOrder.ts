/**
 * Turning a sorted header into `--order-by` (UI-70).
 *
 * The header's key is the table's; the contract wants its column and a
 * direction. The map is the column list itself, so a header that declares no
 * `orderBy` can never produce a term.
 */

import type { Column } from "../components/DataTable.tsx";
import type { SortState } from "./sorting.ts";

export function orderByTerm<T>(
  columns: readonly Column<T>[],
  state: SortState | null,
): string | undefined {
  if (!state) return undefined;
  const column = columns.find((entry) => entry.key === state.key)?.orderBy;
  return column ? `${column}:${state.direction}` : undefined;
}
