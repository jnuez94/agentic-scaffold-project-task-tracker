/**
 * Moving an artifact through its lifecycle (UI-54): draft, review, accepted,
 * superseded. `--if-status` is the status the row was loaded with, so a record
 * that moved underneath the operator is refused rather than overwritten.
 */

import { useState } from "react";
import type { Artifact, ArtifactStatus } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { FormField } from "../components/FormField.tsx";
import {
  ARTIFACT_STATUS_CONSEQUENCE,
  ARTIFACT_STATUSES,
  buildStatusRequest,
  statusAnnouncement,
  statusBlockedReason,
} from "../lib/artifactActions.ts";
import { errorCopy, hasErrorCopy } from "../lib/errorCopy.ts";
import { useApp } from "../state/AppContext.tsx";
import { ArtifactSheet } from "./ArtifactSheet.tsx";

export function ArtifactStatusForm({
  artifact,
  onClose,
  onChanged,
}: {
  artifact: Artifact;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination, identity, announce } = useApp();
  const [status, setStatus] = useState<ArtifactStatus | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = statusBlockedReason(artifact, status);

  const submit = async () => {
    if (pending || blocked || !identity.actorId || !status) return;
    setPending(true);
    setError(null);
    try {
      const result = await coordination.setArtifactStatus(
        artifact.id,
        buildStatusRequest(artifact, status, identity.actorId),
      );
      announce(statusAnnouncement(artifact.id, artifact.status, result));
      onChanged();
      onClose();
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      setError(hasErrorCopy(failure.code) ? errorCopy(failure.code, { subject: "This artifact" }) : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <ArtifactSheet
      title={`Change status · ${artifact.id}`}
      headingId="artifact-status-heading"
      error={error}
      blocked={blocked}
      pending={pending}
      submitLabel="Change status"
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <p>
        <strong>{artifact.type}</strong> is <span className="mono">{artifact.status}</span>.
      </p>
      <FormField id="artifact-status" label="New status">
        {(props) => (
          <select {...props} value={status} onChange={(event) => setStatus(event.target.value as ArtifactStatus | "")}>
            <option value="">Choose…</option>
            {ARTIFACT_STATUSES.map((value) => (
              <option key={value} value={value} disabled={value === artifact.status}>
                {value}
                {value === artifact.status ? " (current)" : ""}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {status ? <p className="small muted">{ARTIFACT_STATUS_CONSEQUENCE[status]}</p> : null}
    </ArtifactSheet>
  );
}
