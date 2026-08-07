/**
 * The optional per-row action column for a record table.
 *
 * Extracted from RecordsView so that view stays under the file-size limit and
 * keeps to one job: it resolves a config, loads rows, and renders a table. How
 * a declared row action becomes a column is a separate, testable concern.
 */

import type { Column } from "../components/DataTable.tsx";
import type { RecordConfig } from "./recordConfigs.tsx";

/**
 * Append the action column when the registry declares one.
 *
 * `applies` decides per row, so the control never appears where the underlying
 * command would refuse it — a dash is shown instead, which keeps the column
 * aligned and says "not applicable here" rather than leaving a gap.
 */
export function withActionColumn(
  config: RecordConfig,
  onAct: (row: Record<string, unknown>, trigger: HTMLButtonElement) => void,
): Column<never>[] {
  if (!config.rowAction) return config.columns;
  const action = config.rowAction;
  return [
    ...config.columns,
    {
      key: "__action",
      header: action.header,
      priority: 1,
      render: (row: Record<string, unknown>) =>
        action.applies(row) ? (
          <button
            type="button"
            className="link-button"
            onClick={(event) => {
              // The row itself opens the inspector; the action is not that.
              event.stopPropagation();
              onAct(row, event.currentTarget);
            }}
          >
            {action.label}
          </button>
        ) : (
          <span className="small muted">—</span>
        ),
    },
  ];
}
