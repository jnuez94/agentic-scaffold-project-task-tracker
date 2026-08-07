/**
 * Changing who is responsible for a task (UI-28).
 *
 * Inline in the inspector rather than a modal, because the operator has to keep
 * seeing the task while deciding who should hold it.
 *
 * The panel's job is to answer three questions the CLI can only answer by
 * refusing: who holds this now and which of them is retired, who may legally be
 * added, and what the result will be. Assignment is not claiming — assignment
 * says who is responsible, a claim says who is actively working under a session
 * — and this panel must not blur the two.
 *
 * Spec: docs/ux-reassign-work-spec.md
 */

import { useEffect, useRef, useState } from "react";
import type { Agent } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { Icon } from "../components/icons.tsx";
import {
  addCandidates,
  assignErrorCopy,
  assignErrorSubject,
  buildAssignRequest,
  EMPTY_DRAFT,
  hasPendingChange,
  resultingAssignees,
  wouldLeaveUnowned,
  type AssignableTask,
  type AssignmentDraft,
} from "../lib/assignment.ts";
import { useApp } from "../state/AppContext.tsx";
import {
  AddAssignee,
  AssignmentAttribution,
  AssignmentError,
  AssignmentResult,
  CurrentAssignees,
} from "./AssigneeFields.tsx";

export function AssigneeEditor({
  task,
  agents,
  onClose,
  onSaved,
}: {
  task: AssignableTask;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { coordination, identity, session, announce } = useApp();
  const [draft, setDraft] = useState<AssignmentDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; stale: boolean } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    // Opening a panel taller than the scrollport otherwise leaves most of it,
    // including the result preview, below the fold with no cue it is there.
    // Optional-called: this is a progressive enhancement, and jsdom has no
    // implementation, so requiring it would fail every test of this component
    // for a scroll that has no observable effect there anyway.
    heading.current?.scrollIntoView?.({ block: "nearest" });
  }, []);

  const { selectable, retired } = addCandidates(agents, task, draft);
  const result = resultingAssignees(task, draft);
  const unowned = wouldLeaveUnowned(task, draft);
  const dirty = hasPendingChange(draft);

  const requestClose = () => {
    if (pending) return;
    // No silent loss: a pending edit is confirmed before it is discarded.
    if (dirty && !globalThis.confirm("Discard these assignee changes?")) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const toggleRemove = (id: string) =>
    setDraft((current) => ({
      ...current,
      remove: current.remove.includes(id)
        ? current.remove.filter((other) => other !== id)
        : [...current.remove, id],
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || pending || !identity.actorId) return;
    setPending(true);
    setError(null);
    try {
      const saved = await coordination.assignTask(
        task.id,
        buildAssignRequest(task, draft, identity.actorId),
      );
      announce(
        `Assignees updated. Now: ${(saved.assignees ?? result).join(", ") || "nobody"}. ` +
          `Revision ${saved.revision}.`,
      );
      setDraft(EMPTY_DRAFT);
      onSaved();
      onClose();
    } catch (caught) {
      const failure =
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", String(caught), 0);
      // The draft survives; nothing is retried automatically.
      setError({
        text: assignErrorCopy(
          failure.code,
          failure.message,
          assignErrorSubject(failure.code, task),
        ),
        stale: failure.code === "stale_task_revision",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="assignee-editor" aria-labelledby="assignees-heading">
      <div className="sheet-header">
        <h3 id="assignees-heading" ref={heading} tabIndex={-1}>
          Change assignees
        </h3>
        <button
          onClick={requestClose}
          aria-label="Close assignee editor"
          className="close"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <form onSubmit={submit}>
        {error ? (
          <AssignmentError
            text={error.text}
            stale={error.stale}
            onReload={onSaved}
          />
        ) : null}

        <CurrentAssignees
          task={task}
          agents={agents}
          draft={draft}
          pending={pending}
          onToggleRemove={toggleRemove}
        />

        <AddAssignee
          selectable={selectable}
          retired={retired}
          staged={draft.add}
          pending={pending}
          onAdd={(id) =>
            setDraft((current) => ({ ...current, add: [...current.add, id] }))
          }
        />

        <AssignmentResult
          result={result}
          removing={draft.remove}
          unowned={unowned}
        />

        <AssignmentAttribution
          actorId={identity.actorId}
          sessionId={session.activeSessionId}
          revision={task.revision}
        />

        <div className="sheet-actions">
          <button
            type="submit"
            className="primary"
            disabled={!dirty || pending || !identity.actorId}
          >
            {pending ? "Saving…" : "Save assignees"}
          </button>
          <button type="button" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
