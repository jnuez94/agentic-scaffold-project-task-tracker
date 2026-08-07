/**
 * Adding evidence — the gate on completing a task.
 */

import { useState } from "react";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { useApp } from "../state/AppContext.tsx";
import { SETUP_PENDING } from "../lib/copy.ts";

export function AddEvidenceForm({
  taskId,
  onAdded,
  onCancel,
}: {
  taskId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const { coordination, identity, announce, mutationsEnabled } = useApp();
  const [uri, setUri] = useState("");
  const [type, setType] = useState("artifact");
  const [error, setError] = useState<ApiError | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identity.actorId) {
      setError(new ApiError("invalid_actor", "Select an actor before adding evidence.", 400));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await coordination.addEvidence({
        task: taskId,
        uri,
        type,
        actor: identity.actorId,
      });
      announce(`Evidence added to ${taskId}.`);
      setUri("");
      onAdded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={(event) => void submit(event)}>
      <h3>Add evidence</h3>
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
      <div className="control">
        <label htmlFor="evidence-uri">Evidence URI</label>
        <input
          id="evidence-uri"
          value={uri}
          required
          placeholder="file://…, git:…, or a test-run reference"
          onChange={(event) => setUri(event.target.value)}
        />
      </div>
      <div className="control">
        <label htmlFor="evidence-type">Type</label>
        <input
          id="evidence-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          placeholder="artifact"
        />
      </div>
      <div className="form-actions">
        <button
          type="submit"
          className="primary"
          disabled={busy || !uri.trim() || !mutationsEnabled}
          title={mutationsEnabled ? undefined : SETUP_PENDING}
        >
          {busy ? "Adding…" : "Add evidence"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
