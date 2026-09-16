/**
 * Recording a review, from the task's Reviews tab (UI-52).
 *
 * After UI-45 the console marks tasks as owing a disposition — eleven of the
 * thirteen attention rows on the live board — and offered no way to give one.
 * The people who give dispositions are the least likely to be at a terminal.
 *
 * The form enforces what a hurried CLI invocation omits: `required_changes`
 * and `blocked_claims` are mandatory, for every decision including accepted.
 * Everything else follows UI-48's treatment — suggested id, free text,
 * reviewer read-only as the acting actor, draft preserved on failure, branch
 * on error.code.
 */

import { useEffect, useRef, useState } from "react";
import type { TaskDetail } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { FormField } from "../components/FormField.tsx";
import { describeThrown } from "../lib/copy.ts";
import {
  buildReviewRequest,
  checkReviewDraft,
  DECISION_CONSEQUENCE,
  DECISION_LABELS,
  emptyReview,
  isDuplicateReviewId,
  REVIEW_DECISIONS,
  suggestReviewId,
  type ReviewDraft,
  type ReviewProblem,
} from "../lib/reviewDraft.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";
import { receiptSuffix } from "../lib/receipt.ts";

export function ReviewForm({
  detail,
  onRecorded,
}: {
  detail: TaskDetail;
  onRecorded: () => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const existing = useResource(() => coordination.reviews({ limit: 500 }), [coordination]);
  const existingIds = (existing.data ?? []).map((entry) => entry.id);

  const [draft, setDraft] = useState<ReviewDraft>(() => emptyReview(detail, []));
  const idTouched = useRef(false);
  useEffect(() => {
    if (!existing.loaded || idTouched.current) return;
    const ids = (existing.data ?? []).map((entry) => entry.id);
    setDraft((current) => ({ ...current, id: suggestReviewId(detail.id, ids) }));
  }, [existing.loaded, existing.data, detail.id]);

  const [problem, setProblem] = useState<ReviewProblem | null>(null);
  const [error, setError] = useState<ApiError | undefined>();
  const [pending, setPending] = useState(false);

  const set = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const problemFor = (field: ReviewProblem["field"]) =>
    problem?.field === field ? problem.message : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const found = checkReviewDraft(draft, { actorId: identity.actorId, existingIds });
    if (found) {
      setProblem(found);
      return;
    }
    setProblem(null);
    setError(undefined);
    setPending(true);
    try {
      const created = await coordination.addReview(
        buildReviewRequest(draft, detail.id, identity.actorId!),
      );
      const id = created.id ?? draft.id.trim();
      announce(
        `Review ${id} recorded on ${detail.id}: ${DECISION_LABELS[draft.decision]}. ` +
          DECISION_CONSEQUENCE[draft.decision] +
          receiptSuffix(created),
      );
      setDraft(emptyReview(detail, [...existingIds, id]));
      onRecorded();
    } catch (caught) {
      const failure =
        caught instanceof ApiError ? caught : new ApiError("network_error", describeThrown(caught), 0);
      if (isDuplicateReviewId(failure.code, failure.details)) {
        setProblem({ field: "id", message: `${draft.id.trim()} already exists. Choose another id.` });
      } else {
        setError(failure);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="review-form" onSubmit={(event) => void submit(event)} aria-label="Record a review">
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
      {problem?.field === "actor" ? (
        <p className="small field-problem" role="alert">
          {problem.message}
        </p>
      ) : null}

      <FormField id="rev-id" label="Id" hint="Suggested; edit freely." error={problemFor("id")}>
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

      <FormField id="rev-reviewer" label="Reviewer">
        {(control) => <input {...control} className="mono" value={identity.actorId ?? ""} readOnly />}
      </FormField>

      <FormField id="rev-decision" label="Decision">
        {(control) => (
          <select {...control} value={draft.decision} onChange={(event) => set("decision", event.target.value as ReviewDraft["decision"])}>
            {REVIEW_DECISIONS.map((value) => (
              <option key={value} value={value}>
                {DECISION_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField id="rev-artifact" label="Artifact" hint="What was reviewed — a commit, a path, a capture. Pre-filled from the latest evidence." error={problemFor("artifact")}>
        {(control) => (
          <input {...control} className="mono" value={draft.artifact} onChange={(event) => set("artifact", event.target.value)} />
        )}
      </FormField>

      <FormField id="rev-scope" label="Scope" error={problemFor("scope")}>
        {(control) => (
          <input {...control} value={draft.scope} onChange={(event) => set("scope", event.target.value)} />
        )}
      </FormField>

      <FormField id="rev-required" label="Required changes" hint="Mandatory. If nothing, say so in words." error={problemFor("requiredChanges")}>
        {(control) => (
          <textarea {...control} rows={3} value={draft.requiredChanges} onChange={(event) => set("requiredChanges", event.target.value)} />
        )}
      </FormField>

      <FormField id="rev-blocked" label="Does not authorize" hint="Mandatory. Every acceptance has a boundary." error={problemFor("blockedClaims")}>
        {(control) => (
          <textarea {...control} rows={2} value={draft.blockedClaims} onChange={(event) => set("blockedClaims", event.target.value)} />
        )}
      </FormField>

      <details className="optional-fields">
        <summary>More</summary>
        <FormField id="rev-accepted" label="Accepted items">
          {(control) => (
            <textarea {...control} rows={2} value={draft.acceptedItems} onChange={(event) => set("acceptedItems", event.target.value)} />
          )}
        </FormField>
        <FormField id="rev-risks" label="Remaining risks">
          {(control) => (
            <textarea {...control} rows={2} value={draft.risks} onChange={(event) => set("risks", event.target.value)} />
          )}
        </FormField>
        <FormField id="rev-follow-up" label="Follow-up tasks" hint="Comma-separated task ids.">
          {(control) => (
            <input {...control} className="mono" value={draft.followUpTasks} onChange={(event) => set("followUpTasks", event.target.value)} />
          )}
        </FormField>
      </details>

      <div className="field-actions">
        <button type="submit" className="primary" disabled={pending || !mutationsEnabled}>
          {pending ? "Recording…" : "Record review"}
        </button>
      </div>
    </form>
  );
}
