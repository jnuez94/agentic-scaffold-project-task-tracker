/**
 * The optional cause on a task transition (UI-72).
 *
 * Nothing is required: a status change without a cause is still a status
 * change. Offered as a disclosure so the footer stays short, and the records
 * it can cite are loaded when it opens, not when the inspector does — the
 * decisions and open escalations are two requests, and most transitions do
 * not cite anything. Only records that exist are offered.
 */

import { NEWEST_FIRST } from "../lib/listQueries.ts";
import { useState } from "react";
import { FormField } from "../components/FormField.tsx";
import { causeOptions, type CauseSubject } from "../lib/because.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const REQUEST_LIMIT = 500;

export function BecausePicker({
  subject,
  value,
  onChange,
  disabled = false,
}: {
  /** The record whose change this is: a task, or an escalation being answered. */
  subject: CauseSubject;
  /** `TYPE:ID`, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { coordination } = useApp();
  const [open, setOpen] = useState(Boolean(value));
  const decisions = useResource(
    // Newest first: a cause is usually recent, and the first 500 missed it (UI-86).
    () => coordination.decisions({ order_by: NEWEST_FIRST, limit: REQUEST_LIMIT }),
    [subject.id],
    { enabled: open },
  );
  const escalations = useResource(
    () => coordination.escalations({ status: "open", order_by: NEWEST_FIRST, limit: REQUEST_LIMIT }),
    [subject.id],
    { enabled: open },
  );

  if (!open) {
    return (
      <button type="button" className="link" onClick={() => setOpen(true)} disabled={disabled}>
        Add a cause…
      </button>
    );
  }

  const options = causeOptions(subject, decisions.data ?? [], escalations.data ?? []);
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
