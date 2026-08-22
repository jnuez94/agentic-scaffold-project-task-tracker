/**
 * Raising an escalation — the one form, wherever it is reached from (UI-49).
 *
 * Health told the operator to "resolve the blocker or escalate" and offered no
 * escalate, which is the same defect class as UI-22 before recovery landed.
 * This is the capability; the inspector hosts it as the primary entry point,
 * and Health's blocked-tasks row opens it pre-filled.
 *
 * Field treatment by ruling: id follows UI-48 — pre-filled with a first guess
 * in the board's own convention, free text, overridable; raised_by is the
 * acting actor and read-only; owner is a select of ACTIVE agents only, even
 * though the CLI accepts free text, because an escalation owned by a retired
 * identity is the SEC-1 failure repeating.
 *
 * Fetches the existing escalation ids itself so both entry points get the same
 * duplicate check and the same suggestion without either having to load them.
 */

import { useEffect, useRef, useState } from "react";
import type { Agent } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { FormField } from "../components/FormField.tsx";
import { describeThrown } from "../lib/copy.ts";
import {
  buildEscalationRequest,
  checkEscalationDraft,
  emptyEscalation,
  isDuplicateEscalationId,
  suggestEscalationId,
  type EscalationDraft,
  type EscalationProblem,
} from "../lib/escalationDraft.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

export function EscalationForm({
  relatedTask,
  prefillIssue = "",
  agents,
  onClose,
  onRaised,
}: {
  /** The task this escalation is about, when opened from one. */
  relatedTask: string | null;
  /** The blocking reason, when opened from Health. */
  prefillIssue?: string;
  agents: readonly Agent[];
  onClose: () => void;
  onRaised: (id: string) => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const existing = useResource(() => coordination.escalations({ limit: 500 }), [coordination]);
  const existingIds = (existing.data ?? []).map((entry) => entry.id);

  const [draft, setDraft] = useState<EscalationDraft>(() =>
    emptyEscalation(relatedTask, prefillIssue, []),
  );
  // The suggested id is recomputed once the existing ids arrive, but only if
  // the operator has not touched it: their text is theirs. The ids are derived
  // inside the effect from `existing.data` so the dependency list is exact
  // and needs no suppression.
  const idTouched = useRef(false);
  useEffect(() => {
    if (!existing.loaded || idTouched.current) return;
    const ids = (existing.data ?? []).map((entry) => entry.id);
    setDraft((current) => ({ ...current, id: suggestEscalationId(relatedTask, ids) }));
  }, [existing.loaded, existing.data, relatedTask]);

  const [problem, setProblem] = useState<EscalationProblem | null>(null);
  const [error, setError] = useState<ApiError | undefined>();
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const set = <K extends keyof EscalationDraft>(key: K, value: EscalationDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = checkEscalationDraft(draft, { actorId: identity.actorId, existingIds });
    if (found) {
      setProblem(found);
      return;
    }
    setProblem(null);
    setError(undefined);
    setPending(true);
    try {
      const created = await coordination.addEscalation(
        buildEscalationRequest(draft, identity.actorId!),
      );
      const id = created.id ?? draft.id.trim();
      announce(`Escalation ${id} raised to ${draft.owner}. It is open until they record a resolution.`);
      onRaised(id);
    } catch (caught) {
      const failure =
        caught instanceof ApiError
          ? caught
          : new ApiError("network_error", describeThrown(caught), 0);
      if (isDuplicateEscalationId(failure.code, failure.details)) {
        setProblem({ field: "id", message: `${draft.id.trim()} already exists. Choose another id.` });
      } else {
        setError(failure);
      }
    } finally {
      setPending(false);
    }
  };

  const problemFor = (field: EscalationProblem["field"]) =>
    problem?.field === field ? problem.message : undefined;

  return (
    <section className="escalation-form" aria-labelledby="escalate-heading">
      <div className="inspector-section-head">
        <h3 id="escalate-heading" ref={heading} tabIndex={-1}>
          Escalate
        </h3>
        <button type="button" className="link-button" onClick={onClose} disabled={pending}>
          Cancel
        </button>
      </div>

      <form onSubmit={(event) => void submit(event)}>
        {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
        {problem?.field === "actor" ? (
          <p className="small field-problem" role="alert">
            {problem.message}
          </p>
        ) : null}

        <FormField id="esc-id" label="Id" hint="Suggested; edit freely. Ids cannot be changed later." error={problemFor("id")}>
          {(control) => (
            <input
              {...control}
              className="mono"
              value={draft.id}
              onChange={(event) => {
                idTouched.current = true;
                set("id", event.target.value);
              }}
            />
          )}
        </FormField>

        <FormField id="esc-raised-by" label="Raised by">
          {(control) => (
            <input {...control} className="mono" value={identity.actorId ?? ""} readOnly />
          )}
        </FormField>

        <FormField id="esc-owner" label="Owner" hint="Who has the authority to decide. Active agents only." error={problemFor("owner")}>
          {(control) => (
            <select {...control} value={draft.owner} onChange={(event) => set("owner", event.target.value)}>
              <option value="">Choose an owner…</option>
              {agents.filter(isSelectableActor).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agentOptionLabel(agent)}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField id="esc-related" label="Related tasks" hint="Comma-separated task ids.">
          {(control) => (
            <input {...control} className="mono" value={draft.relatedTasks} onChange={(event) => set("relatedTasks", event.target.value)} />
          )}
        </FormField>

        <FormField id="esc-issue" label="Issue" error={problemFor("issue")}>
          {(control) => (
            <textarea {...control} rows={4} value={draft.issue} onChange={(event) => set("issue", event.target.value)} />
          )}
        </FormField>

        <FormField id="esc-decision" label="Requested decision" error={problemFor("requestedDecision")}>
          {(control) => (
            <textarea {...control} rows={3} value={draft.requestedDecision} onChange={(event) => set("requestedDecision", event.target.value)} />
          )}
        </FormField>

        <FormField id="esc-needed-by" label="Needed by (optional)">
          {(control) => (
            <input {...control} value={draft.neededBy} onChange={(event) => set("neededBy", event.target.value)} placeholder="A date or a milestone" />
          )}
        </FormField>

        <div className="field-actions">
          <button type="submit" className="primary" disabled={pending || !mutationsEnabled}>
            {pending ? "Raising…" : "Raise escalation"}
          </button>
        </div>
      </form>
    </section>
  );
}
