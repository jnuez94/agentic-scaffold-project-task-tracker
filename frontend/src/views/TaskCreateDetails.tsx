/**
 * The optional fields of a new task, behind a collapsed disclosure (UI-48).
 *
 * Split from TaskCreatePanel the way BroadcastFields is split from its
 * composer: the panel owns the draft, the submit, and the refusal handling;
 * this owns only the fields an operator reaches for when they have more to
 * say than a title and a description. Collapsed by default because, on this
 * board, most tasks are filed with neither acceptance criteria nor blocked
 * claims, and five open textareas would bury the submit button — the UI-28
 * defect, reintroduced.
 */

import { FormField } from "../components/FormField.tsx";
import { PRIORITIES, type TaskDraft } from "../lib/taskDraft.ts";

export function TaskCreateDetails({
  draft,
  onChange,
}: {
  draft: TaskDraft;
  onChange: <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => void;
}) {
  const set = onChange;
  return (
      <details className="optional-fields">
        <summary>Details</summary>
        <FormField id="create-priority" label="Priority">
          {(control) => (
            <select
              {...control}
              value={draft.priority}
              onChange={(event) => set("priority", Number(event.target.value))}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                  {value === 1 ? " — highest" : value === 5 ? " — lowest" : ""}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id="create-tags" label="Tags" hint="Comma-separated.">
          {(control) => (
            <input
              {...control}
              value={draft.tags}
              onChange={(event) => set("tags", event.target.value)}
            />
          )}
        </FormField>
        <FormField id="create-acceptance" label="Acceptance criteria">
          {(control) => (
            <textarea
              {...control}
              rows={3}
              value={draft.acceptance}
              onChange={(event) => set("acceptance", event.target.value)}
            />
          )}
        </FormField>
        <FormField id="create-next-steps" label="Next steps">
          {(control) => (
            <textarea
              {...control}
              rows={2}
              value={draft.nextSteps}
              onChange={(event) => set("nextSteps", event.target.value)}
            />
          )}
        </FormField>
        <FormField
          id="create-blocked-claims"
          label="Blocked claims"
          hint="What this task does not authorise."
        >
          {(control) => (
            <textarea
              {...control}
              rows={2}
              value={draft.blockedClaims}
              onChange={(event) => set("blockedClaims", event.target.value)}
            />
          )}
        </FormField>
      </details>
  );
}
