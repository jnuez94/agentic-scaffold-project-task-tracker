/**
 * Filing a task from the console (UI-48).
 *
 * The largest single gap the console had: every task on the board was created
 * from a terminal, and the most basic interruption an operator can make — this
 * needs doing — required leaving the application.
 *
 * Field order is the ruling, amended on measurement. Visible: id, title,
 * assignee, description. Behind a collapsed Details disclosure: priority, tags,
 * acceptance criteria, next steps, blocked claims. Description is visible
 * rather than tags because this board's tags are 72-of-117 unique and useless
 * for scanning, while a description is what makes a task pickupable by anyone
 * other than its author — on a multi-agent board, the difference between work
 * and a note-to-self. Id stays first because it is the only field with no
 * correction path.
 *
 * This is an in-route side panel in the inspector's slot, not a modal sheet:
 * the same `aside` pattern the inspector uses, heading focused on open, Escape
 * closes, no aria-modal because nothing is made inert behind it — and being
 * able to glance at the queue while choosing an id is a feature.
 */

import { useEffect, useRef, useState } from "react";
import type { Agent } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { FormField } from "../components/FormField.tsx";
import { Icon } from "../components/icons.tsx";
import { describeThrown } from "../lib/copy.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import {
  buildCreateRequest,
  checkTaskDraft,
  duplicateIdCopy,
  EMPTY_DRAFT,
  isDuplicateId,
  nextFreeId,
  prefixesInUse,
  prefixOf,
  type DraftProblem,
  type TaskDraft,
} from "../lib/taskDraft.ts";
import { useApp } from "../state/AppContext.tsx";
import { TaskCreateDetails } from "./TaskCreateDetails.tsx";

export function TaskCreatePanel({
  existingIds,
  agents,
  onClose,
  onCreated,
}: {
  /** Ids of the loaded tasks: for prefixes, next-free, and the duplicate check. */
  existingIds: readonly string[];
  agents: readonly Agent[];
  onClose: () => void;
  /** Called with the new id after the CLI accepts it. */
  onCreated: (id: string) => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const prefixes = prefixesInUse(existingIds);
  const defaultPrefix = prefixes[0]?.prefix ?? "TASK";

  const [draft, setDraft] = useState<TaskDraft>({
    id: nextFreeId(defaultPrefix, existingIds),
    ...EMPTY_DRAFT,
  });
  const [problem, setProblem] = useState<DraftProblem | null>(null);
  const [error, setError] = useState<ApiError | undefined>();
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // The select rewrites the id to that prefix's next free number. The id
  // input stays free text: the select is a shortcut, not the only route.
  const choosePrefix = (prefix: string) => set("id", nextFreeId(prefix, existingIds));
  const currentPrefix = prefixOf(draft.id) ?? "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = checkTaskDraft(draft, { actorId: identity.actorId, existingIds });
    if (found) {
      setProblem(found);
      return;
    }
    setProblem(null);
    setError(undefined);
    setPending(true);
    try {
      const created = await coordination.createTask(
        buildCreateRequest(draft, identity.actorId!),
      );
      const id = created.id ?? draft.id.trim();
      announce(`${id} filed. It is in todo${draft.assignee ? ` and assigned to ${draft.assignee}` : " and unassigned"}.`);
      onCreated(id);
    } catch (caught) {
      const failure =
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", describeThrown(caught), 0);
      if (isDuplicateId(failure.code, failure.details)) {
        // The CLI is the authority on uniqueness; the loaded window may have
        // been stale. The draft survives and the way out is offered.
        setProblem({ field: "id", message: duplicateIdCopy(draft.id.trim(), [...existingIds, draft.id.trim()]) });
      } else {
        setError(failure);
      }
    } finally {
      setPending(false);
    }
  };

  const idProblem = problem?.field === "id" ? problem.message : undefined;
  const titleProblem = problem?.field === "title" ? problem.message : undefined;

  return (
    <aside className="inspector" aria-labelledby="create-task-heading">
      <div className="inspector-header">
        <div>
          <span className="small muted">New</span>
          <h2 id="create-task-heading" ref={heading} tabIndex={-1}>
            File a task
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close new task"
          className="close"
          onClick={onClose}
          disabled={pending}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <form className="inspector-body create-task" onSubmit={(event) => void submit(event)}>
        {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
        {problem?.field === "actor" ? (
          <p className="small field-problem" role="alert">
            {problem.message}
          </p>
        ) : null}

        <FormField
          id="create-id"
          label="Id"
          hint="Pre-filled with the next free number. Ids cannot be changed later."
          error={idProblem}
        >
          {(control) => (
            <div className="create-id-row">
              <select
                aria-label="Id prefix"
                value={currentPrefix}
                onChange={(event) => choosePrefix(event.target.value)}
              >
                {!currentPrefix ? <option value="">—</option> : null}
                {prefixes.map((entry) => (
                  <option key={entry.prefix} value={entry.prefix}>
                    {entry.prefix}
                  </option>
                ))}
                {currentPrefix && !prefixes.some((p) => p.prefix === currentPrefix) ? (
                  <option value={currentPrefix}>{currentPrefix}</option>
                ) : null}
              </select>
              <input
                {...control}
                className="mono"
                value={draft.id}
                onChange={(event) => set("id", event.target.value)}
              />
            </div>
          )}
        </FormField>

        <FormField id="create-title" label="Title" error={titleProblem}>
          {(control) => (
            <input
              {...control}
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
            />
          )}
        </FormField>

        <FormField id="create-assignee" label="Assignee">
          {(control) => (
            <select
              {...control}
              value={draft.assignee}
              onChange={(event) => set("assignee", event.target.value)}
            >
              <option value="">Unassigned</option>
              {agents.filter(isSelectableActor).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agentOptionLabel(agent)}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField
          id="create-description"
          label="Description"
          hint="What makes this pickupable by someone other than you."
        >
          {(control) => (
            <textarea
              {...control}
              rows={4}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
            />
          )}
        </FormField>

        <TaskCreateDetails draft={draft} onChange={set} />

        <div className="field-actions">
          <button type="submit" className="primary" disabled={pending || !mutationsEnabled}>
            {pending ? "Filing…" : "File task"}
          </button>
          <button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
