/**
 * Registering an artifact (UI-54): what it is, where it lives, who owns it,
 * and what it does not authorise. Paths are recorded, not verified — the
 * console resolves nothing — and the owner defaults to the acting actor.
 */

import { useState } from "react";
import type { Agent, ArtifactStatus } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { FormField } from "../components/FormField.tsx";
import {
  ARTIFACT_STATUSES,
  buildRegistrationRequest,
  emptyRegistration,
  registrationAnnouncement,
  registrationBlockedReason,
} from "../lib/artifactActions.ts";
import { NOT_VERIFIED_MANY } from "../lib/artifactPaths.ts";
import { agentOptionLabel, isSelectableActor } from "../lib/labels.ts";
import { useApp } from "../state/AppContext.tsx";
import { ArtifactSheet } from "./ArtifactSheet.tsx";

export function ArtifactRegisterForm({
  agents,
  onClose,
  onCreated,
}: {
  agents: readonly Agent[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { coordination, identity, announce } = useApp();
  const [draft, setDraft] = useState(() => emptyRegistration(identity.actorId ?? ""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = registrationBlockedReason(draft);
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft({ ...draft, [key]: value });

  const submit = async () => {
    if (pending || blocked || !identity.actorId) return;
    setPending(true);
    setError(null);
    try {
      const body = buildRegistrationRequest(draft);
      const created = await coordination.addArtifact(body);
      announce(registrationAnnouncement(String(body.id), draft.status, created));
      onCreated(String(body.id));
      onClose();
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      setError(failure.code === "constraint_violation" ? "An artifact with that id or path already exists." : failure.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <ArtifactSheet
      title="Register artifact"
      headingId="artifact-register-heading"
      error={error}
      blocked={blocked}
      pending={pending}
      submitLabel="Register artifact"
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <FormField id="new-artifact-id" label="Id" hint="Letters, digits and . _ : @ + - ; unique across the database.">
        {(props) => <input {...props} value={draft.id} onChange={(event) => set("id", event.target.value)} />}
      </FormField>
      <FormField id="new-artifact-paths" label="Paths, one per line" hint={NOT_VERIFIED_MANY}>
        {(props) => <textarea {...props} rows={3} value={draft.paths} onChange={(event) => set("paths", event.target.value)} />}
      </FormField>
      <FormField id="new-artifact-type" label="Type" hint="Free text: document, spec, capture, bundle…">
        {(props) => <input {...props} value={draft.type} onChange={(event) => set("type", event.target.value)} />}
      </FormField>
      <FormField id="new-artifact-status" label="Status">
        {(props) => (
          <select {...props} value={draft.status} onChange={(event) => set("status", event.target.value as ArtifactStatus)}>
            {ARTIFACT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField id="new-artifact-owner" label="Owner">
        {(props) => (
          <select {...props} value={draft.owner} onChange={(event) => set("owner", event.target.value)}>
            <option value="">Choose…</option>
            {agents.filter(isSelectableActor).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agentOptionLabel(agent)}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField id="new-artifact-boundaries" label="Usage boundaries" hint="What this artifact does not authorise.">
        {(props) => (
          <textarea {...props} rows={2} value={draft.usageBoundaries} onChange={(event) => set("usageBoundaries", event.target.value)} />
        )}
      </FormField>
      <FormField id="new-artifact-tasks" label="Related tasks" hint="Task ids, separated by commas or spaces.">
        {(props) => <input {...props} value={draft.tasks} onChange={(event) => set("tasks", event.target.value)} />}
      </FormField>
      <FormField id="new-artifact-reviewers" label="Reviewers" hint="Agent ids, separated by commas or spaces.">
        {(props) => <input {...props} value={draft.reviewers} onChange={(event) => set("reviewers", event.target.value)} />}
      </FormField>
    </ArtifactSheet>
  );
}
