/**
 * Correcting an artifact record in place (UI-54): its paths, type and usage
 * boundaries. URIs are paths and paths move — 4 of 15 on this board already
 * dangled — and the fix is to correct the record, not to register a
 * superseding duplicate. Status, owner, related tasks and reviewers are not
 * this command's to change and are not offered here.
 */

import { useState } from "react";
import type { Artifact } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { FormField } from "../components/FormField.tsx";
import {
  buildCorrectionRequest,
  correctionAnnouncement,
  correctionBlockedReason,
  correctionChanges,
  correctionDraftFrom,
} from "../lib/artifactActions.ts";
import { NOT_VERIFIED_MANY } from "../lib/artifactPaths.ts";
import { errorCopy, hasErrorCopy } from "../lib/errorCopy.ts";
import { useApp } from "../state/AppContext.tsx";
import { ArtifactSheet } from "./ArtifactSheet.tsx";

export function ArtifactCorrectionForm({
  artifact,
  onClose,
  onChanged,
}: {
  artifact: Artifact;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination, identity, announce } = useApp();
  const [draft, setDraft] = useState(() => correctionDraftFrom(artifact));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = correctionBlockedReason(artifact, draft);

  const submit = async () => {
    if (pending || blocked || !identity.actorId) return;
    setPending(true);
    setError(null);
    try {
      const changes = correctionChanges(artifact, draft);
      const result = await coordination.updateArtifact(
        artifact.id,
        buildCorrectionRequest(artifact, draft, identity.actorId),
      );
      announce(correctionAnnouncement(artifact.id, changes, result));
      onChanged();
      onClose();
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      // The draft stays; nothing retries on its own.
      setError(hasErrorCopy(failure.code) ? errorCopy(failure.code, { subject: "This artifact" }) : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <ArtifactSheet
      title={`Correct record · ${artifact.id}`}
      headingId="artifact-correct-heading"
      error={error}
      blocked={blocked}
      pending={pending}
      submitLabel="Correct record"
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <p className="small muted">
        Corrects the record in place; the change and the fields it touched are audited. Status,
        owner, related tasks and reviewers are not changed here.
      </p>
      <FormField id="artifact-paths" label="Paths, one per line" hint={NOT_VERIFIED_MANY}>
        {(props) => (
          <textarea {...props} rows={4} value={draft.paths} onChange={(event) => setDraft({ ...draft, paths: event.target.value })} />
        )}
      </FormField>
      <FormField id="artifact-type" label="Type">
        {(props) => <input {...props} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} />}
      </FormField>
      <FormField id="artifact-boundaries" label="Usage boundaries" hint="What this artifact does not authorise.">
        {(props) => (
          <textarea
            {...props}
            rows={3}
            value={draft.usageBoundaries}
            onChange={(event) => setDraft({ ...draft, usageBoundaries: event.target.value })}
          />
        )}
      </FormField>
    </ArtifactSheet>
  );
}
