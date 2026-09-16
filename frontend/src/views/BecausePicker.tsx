/**
 * The optional cause on a task transition (UI-72).
 *
 * Nothing is required: a status change without a cause is still a status
 * change. Offered as a disclosure so the footer stays short, and the records
 * it can cite are loaded when it opens, not when the inspector does — the
 * decisions and open escalations are two requests, and most transitions do
 * not cite anything. Only records that exist are offered.
 */

import { useState } from "react";
import type { TaskDetail } from "../api/contract.ts";
import { FormField } from "../components/FormField.tsx";
import { causeOptions } from "../lib/because.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const REQUEST_LIMIT = 500;

export function BecausePicker({
  task,
  value,
  onChange,
  disabled = false,
}: {
  task: TaskDetail;
  /** `TYPE:ID`, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { coordination } = useApp();
  const [open, setOpen] = useState(Boolean(value));
  const decisions = useResource(
    () => coordination.decisions({ limit: REQUEST_LIMIT }),
    [task.id],
    { enabled: open },
  );
  const escalations = useResource(
    () => coordination.escalations({ status: "open", limit: REQUEST_LIMIT }),
    [task.id],
    { enabled: open },
  );

  if (!open) {
    return (
      <button type="button" className="link" onClick={() => setOpen(true)} disabled={disabled}>
        Add a cause…
      </button>
    );
  }

  const options = causeOptions(task, decisions.data ?? [], escalations.data ?? []);
  const loading = decisions.loading || escalations.loading;

  return (
    <FormField
      id="transition-because"
      label="Because (optional)"
      className="control"
      hint="A record this change follows from; it is written into the audit trail."
    >
      {(props) => (
        <select {...props} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          <option value="">{loading ? "Loading…" : options.length ? "No cause" : "Nothing to cite"}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
