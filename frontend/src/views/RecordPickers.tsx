/**
 * The pickers above a record table (UI-70).
 *
 * Selects for enum and agent columns, a typed field for the free ones; each
 * is one `--where` clause on the request. The typed field applies on Enter or
 * blur rather than per keystroke, because each application is a request.
 */

import { useState } from "react";
import type { Agent } from "../api/contract.ts";
import { pickerOptions, type PickerSpec, type PickerValues } from "../lib/recordPickers.ts";

export function RecordPickers({
  pickers,
  values,
  agents,
  idPrefix,
  onChange,
}: {
  pickers: readonly PickerSpec[];
  values: PickerValues;
  agents: readonly Agent[];
  idPrefix: string;
  onChange: (column: string, value: string) => void;
}) {
  return (
    <>
      {pickers.map((spec) => {
        const id = `${idPrefix}-pick-${spec.column}`;
        const value = values[spec.column] ?? "";
        if (spec.kind === "text") {
          return (
            <TextPicker key={spec.column} id={id} spec={spec} value={value} onApply={onChange} />
          );
        }
        return (
          <div className="control" key={spec.column}>
            <label htmlFor={id}>{spec.label}</label>
            <select
              id={id}
              value={value}
              onChange={(event) => onChange(spec.column, event.target.value)}
            >
              <option value="">All</option>
              {pickerOptions(spec, agents).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </>
  );
}

function TextPicker({
  id,
  spec,
  value,
  onApply,
}: {
  id: string;
  spec: PickerSpec;
  value: string;
  onApply: (column: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const apply = () => {
    const next = draft.trim();
    if (next !== value) onApply(spec.column, next);
  };
  return (
    <div className="control">
      <label htmlFor={id}>{spec.label}</label>
      <input
        id={id}
        type="search"
        value={draft}
        placeholder="exact value"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
      />
    </div>
  );
}
