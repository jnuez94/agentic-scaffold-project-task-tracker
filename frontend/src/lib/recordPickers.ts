/**
 * Structured pickers that narrow the request (UI-70).
 *
 * Every picker here names a column the contract lists as filterable for the
 * entity, and becomes one `--where COLUMN:eq=VALUE` clause. That is the
 * difference from the filter box beside them: a picker narrows what the CLI
 * returns, so the window is the newest 500 matches; the box narrows what was
 * loaded, because free text has no CLI equivalent. Assignee is neither — it
 * is `task list`'s own flag, and stays that.
 */

import type { Agent } from "../api/contract.ts";
import { agentOptionLabel } from "./labels.ts";

export type PickerKind = "enum" | "agent" | "recipient" | "text";

export interface PickerSpec {
  /** The filterable column, as the contract names it. */
  column: string;
  label: string;
  kind: PickerKind;
  /** The enum's choices; ignored for other kinds. */
  values?: readonly string[];
}

/** Column to chosen value; "" or absent means not narrowing. */
export type PickerValues = Record<string, string>;

export interface PickerOption {
  value: string;
  label: string;
}

export function whereClauses(values: PickerValues): string[] {
  return Object.entries(values)
    .filter(([, value]) => value !== "")
    .map(([column, value]) => `${column}:eq=${value}`);
}

export function anyPicked(values: PickerValues): boolean {
  return Object.values(values).some((value) => value !== "");
}

/**
 * What a select offers. Agents are offered by name and id, retired ones
 * included: this is a lens over existing records, and work recorded against a
 * retired identity must remain findable.
 */
export function pickerOptions(spec: PickerSpec, agents: readonly Agent[]): PickerOption[] {
  switch (spec.kind) {
    case "enum":
      return (spec.values ?? []).map((value) => ({ value, label: value }));
    case "agent":
      return agents.map((agent) => ({ value: agent.id, label: agentOptionLabel(agent) }));
    case "recipient":
      return [
        { value: "team", label: "team" },
        ...agents.map((agent) => ({ value: agent.id, label: agentOptionLabel(agent) })),
      ];
    case "text":
      return [];
  }
}
