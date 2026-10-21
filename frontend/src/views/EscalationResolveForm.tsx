/**
 * Answering an escalation (UI-82). The question — the issue and the decision
 * requested — sits read-only above the fields, so the answer is written
 * beside it. The resolution is required and is the record; follow-ups must be
 * tasks on this board; a cause is optional. `--if-status` is the status the
 * row was loaded with, so an escalation answered elsewhere is refused rather
 * than answered twice.
 */

import { useState } from "react";
import type { Escalation, TaskListRow } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { Field, TextBlock } from "../components/Fields.tsx";
import { FormField } from "../components/FormField.tsx";
import { splitIds } from "../lib/artifactActions.ts";
import { errorCopy, hasErrorCopy } from "../lib/errorCopy.ts";
import {
  buildResolutionRequest,
  emptyResolution,
  ownerNote,
  RESOLUTION_OUTCOMES,
  resolutionAnnouncement,
  resolutionBlockedReason,
  type ResolutionDraft,
} from "../lib/escalationResolution.ts";
import { useApp } from "../state/AppContext.tsx";
import { BecausePicker } from "./BecausePicker.tsx";
import { RecordSheet } from "./RecordSheet.tsx";
import { SinceLoaded } from "./SinceLoaded.tsx";
import { EDITING } from "../lib/sinceLoaded.ts";

export function EscalationResolveForm({
  escalation,
  tasks,
  onClose,
  onChanged,
}: {
  escalation: Escalation;
  tasks: readonly TaskListRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination, identity, announce } = useApp();
  const [draft, setDraft] = useState<ResolutionDraft>(emptyResolution);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // UI-33: a status_mismatch shows what changed since the row was loaded.
  const [mismatch, setMismatch] = useState(false);
  const blocked = resolutionBlockedReason(draft, tasks.map((task) => task.id));
  const note = ownerNote(escalation, identity.actorId);
  const set = <K extends keyof ResolutionDraft>(key: K, value: ResolutionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (pending || blocked || !identity.actorId) return;
    setPending(true);
    setError(null);
    setMismatch(false);
    try {
      const result = await coordination.resolveEscalation(
        escalation.id,
        buildResolutionRequest(escalation, draft, identity.actorId),
      );
      announce(resolutionAnnouncement(escalation.id, draft.outcome, result));
      onChanged();
      onClose();
    } catch (caught) {
      // The draft stays as typed: a refusal costs no re-entry.
      const failure = caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      setMismatch(failure.code === "status_mismatch");
      setError(hasErrorCopy(failure.code) ? errorCopy(failure.code, { subject: "This escalation" }) : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <RecordSheet
      title={`Resolve · ${escalation.id}`}
      headingId="escalation-resolve-heading"
      error={error}
      conflict={mismatch ? <SinceLoaded objectType="escalation" objectId={escalation.id} loaded={{ status: escalation.status }} editing={EDITING.status} /> : undefined}
      blocked={blocked}
      pending={pending}
      submitLabel="Resolve"
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <Field label="Issue">
        <TextBlock text={escalation.issue} />
      </Field>
      <Field label="Requested decision">
        <TextBlock text={escalation.requested_decision} />
      </Field>

      <fieldset className="field outcome-choice">
        <legend className="field-label">Outcome</legend>
        {RESOLUTION_OUTCOMES.map((option) => (
          <label key={option.value} className="control-check">
            <input
              type="radio"
              name="resolution-outcome"
              value={option.value}
              checked={draft.outcome === option.value}
              onChange={() => set("outcome", option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <FormField id="resolve-resolution" label="Resolution" hint="What was decided and by whom. This is the record.">
        {(props) => (
          <textarea {...props} rows={4} value={draft.resolution} onChange={(event) => set("resolution", event.target.value)} />
        )}
      </FormField>
      <FormField id="resolve-follow-ups" label="Follow-up tasks (optional)" hint="Task ids, separated by commas or spaces.">
        {(props) => (
          <input {...props} className="mono" value={draft.followUps} onChange={(event) => set("followUps", event.target.value)} />
        )}
      </FormField>
      <BecausePicker
        subject={{ id: escalation.id, reviews: [], alsoNamed: splitIds(escalation.related_tasks) }}
        value={draft.because}
        onChange={(value) => set("because", value)}
        disabled={pending}
      />

      {note ? <p className="small muted">{note}</p> : null}
    </RecordSheet>
  );
}
