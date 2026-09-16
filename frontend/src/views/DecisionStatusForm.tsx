/**
 * A ruling on a recorded decision (UI-73).
 *
 * Decisions on this board read "proposed" long after they were settled,
 * because the CLI only gained `decision status` in 1.3.0. This is the console
 * path for it: pick the status, say why, and the change carries the loaded
 * status as its compare-and-swap so nothing is overwritten unseen.
 */

import { useEffect, useRef, useState } from "react";
import type { Decision, DecisionStatus } from "../api/contract.ts";
import { ApiError } from "../api/errors.ts";
import { FormField } from "../components/FormField.tsx";
import { Icon } from "../components/icons.tsx";
import {
  buildRulingRequest,
  DECISION_STATUSES,
  RULING_CONSEQUENCE,
  rulingAnnouncement,
  rulingBlockedReason,
  type RulingDraft,
} from "../lib/decisionRuling.ts";
import { errorCopy, hasErrorCopy } from "../lib/errorCopy.ts";
import { useApp } from "../state/AppContext.tsx";
import { useFocusTrap } from "../state/useFocusTrap.ts";

export function DecisionStatusForm({
  decision,
  onClose,
  onChanged,
}: {
  decision: Decision;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { coordination, identity, session, announce } = useApp();
  const [draft, setDraft] = useState<RulingDraft>({ status: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useFocusTrap(sheet, true);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const blocked = rulingBlockedReason(decision, draft);

  const submit = async () => {
    if (pending || blocked || !identity.actorId || !draft.status) return;
    setPending(true);
    setError(null);
    try {
      const result = await coordination.setDecisionStatus(
        decision.id,
        buildRulingRequest(decision, draft, identity.actorId),
      );
      announce(rulingAnnouncement(result));
      onChanged();
      onClose();
    } catch (caught) {
      const failure =
        caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      // The draft stays; nothing retries on its own.
      setError(
        hasErrorCopy(failure.code)
          ? errorCopy(failure.code, { subject: "This decision" })
          : failure.message,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-labelledby="ruling-heading">
      <div className="sheet-header">
        <h2 id="ruling-heading" ref={heading} tabIndex={-1}>
          Change status · {decision.id}
        </h2>
        <button onClick={() => !pending && onClose()} aria-label="Close" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="sheet-body">
        {error ? (
          <div className="error-banner" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        <p>
          <strong>{decision.title}</strong> is <span className="mono">{decision.status}</span>.
          The change is recorded with your note in the audit trail; the decision text itself
          is not edited.
        </p>

        <FormField id="ruling-status" label="New status">
          {(props) => (
            <select
              {...props}
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as DecisionStatus | "" })
              }
            >
              <option value="">Choose…</option>
              {DECISION_STATUSES.map((status) => (
                <option key={status} value={status} disabled={status === decision.status}>
                  {status}
                  {status === decision.status ? " (current)" : ""}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {draft.status ? <p className="small muted">{RULING_CONSEQUENCE[draft.status]}</p> : null}

        <FormField id="ruling-note" label="Why" hint="Required here. Name what replaced it if it is superseded.">
          {(props) => (
            <textarea
              {...props}
              rows={3}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          )}
        </FormField>

        <p className="small muted attribution">
          Acting as <span className="mono">{identity.actorId ?? "no actor"}</span>
          {session.activeSessionId ? (
            <>
              {" "}
              in session <span className="mono">{session.activeSessionId}</span>
            </>
          ) : null}
          .
        </p>

        <div className="sheet-actions">
          <button
            type="button"
            className="primary"
            disabled={pending || Boolean(blocked) || !identity.actorId}
            aria-describedby={blocked ? "ruling-blocked" : undefined}
            onClick={() => void submit()}
          >
            {pending ? "Recording…" : "Change status"}
          </button>
          <button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
        </div>
        {blocked ? (
          <p id="ruling-blocked" className="small muted">
            {blocked}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
