/**
 * The queue's two filters.
 *
 * Extracted from TasksView so that view stays readable while UI-42 adds the
 * attention strip above it; the markup and behaviour are unchanged.
 */

import type { Agent } from "../api/contract.ts";
import { TASK_STATUSES } from "../api/contract.ts";
import { agentOptionLabel } from "../lib/labels.ts";
import { ALL_SCOPE, OPEN_SCOPE, SCOPE_LABELS, type QueueScope } from "../state/queueScopeStore.ts";

export function QueueToolbar({
  scope,
  onScope,
  assignee,
  onAssignee,
  agents,
}: {
  scope: QueueScope;
  onScope: (scope: QueueScope) => void;
  assignee: string;
  onAssignee: (assignee: string) => void;
  agents: Agent[];
}) {
  return (
    <div className="queue-toolbar">
      {/* One control, not a scope toggle beside a status filter: two of them
          can contradict each other, and this one is on screen whenever the
          queue is, so a remembered choice can never look like a task that
          vanished. */}
      <div className="control">
        <label htmlFor="status-filter">State</label>
        <select
          id="status-filter"
          value={scope}
          onChange={(event) => onScope(event.target.value as QueueScope)}
        >
          <option value={OPEN_SCOPE}>{SCOPE_LABELS[OPEN_SCOPE]}</option>
          <option value={ALL_SCOPE}>{SCOPE_LABELS[ALL_SCOPE]}</option>
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="control">
        <label htmlFor="assignee-filter">Assignee</label>
        <select
          id="assignee-filter"
          value={assignee}
          onChange={(event) => onAssignee(event.target.value)}
        >
          <option value="">Anyone</option>
          {/* Name alone is not an identity. Two distinct agent records share
              the display name "Toby" — one active, one retired — and rendering
              just the name gave the operator two identical options with no way
              to tell which one owns SEC-1. Retired agents stay selectable
              here: this is a lens over existing records, and historical
              assignments to retired identities must remain filterable. Only
              "Acting as" gates on status. */}
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agentOptionLabel(agent)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
