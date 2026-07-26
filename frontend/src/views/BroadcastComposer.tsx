/**
 * The team broadcast composer.
 *
 * A side sheet at 900px and above, a full-screen sequential view below that.
 * Sender and recipient are read-only: the recipient is always the literal
 * `team`, and the sender is whichever human actor is selected.
 */

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/errors.ts";
import { ErrorBanner } from "../components/Feedback.tsx";
import { BroadcastFields } from "./BroadcastFields.tsx";
import { Icon } from "../components/icons.tsx";
import { buildBroadcastRequest, checkBody, requiresNewId } from "../lib/broadcast.ts";
import { newBroadcastId } from "../lib/messageId.ts";
import { absoluteTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";
import { useFocusTrap } from "../state/useFocusTrap.ts";

export interface BroadcastComposerProps {
  senderId: string;
  senderName: string;
  sessionId: string;
  onClose: () => void;
  onSent: () => void;
}

export function BroadcastComposer({
  senderId,
  senderName,
  sessionId,
  onClose,
  onSent,
}: BroadcastComposerProps) {
  const { coordination, announce } = useApp();
  const [body, setBody] = useState("");
  const [task, setTask] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<ApiError | undefined>();
  const [bodyError, setBodyError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{ id: string; at: string } | null>(null);
  // Resolved once per attempt and reused, except after a duplicate-id failure.
  const attemptId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sheet = useRef<HTMLElement>(null);

  // `aria-modal="true"` is a promise that the rest of the page is unavailable.
  // Without this, Tab walked out into the navigation behind the dialog and the
  // promise was false.
  useFocusTrap(sheet, true);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const hasDraft = Boolean(body.trim() || task.trim() || tags.trim());

  const requestClose = () => {
    if (pending) return;
    if (hasDraft && !sent) {
      const discard = globalThis.confirm("Discard this broadcast draft?");
      if (!discard) return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const checked = checkBody(body);
    if (!checked.valid) {
      setBodyError(checked.reason);
      return;
    }
    setBodyError(undefined);
    setError(undefined);
    setPending(true);

    if (!attemptId.current) attemptId.current = newBroadcastId();
    const request = buildBroadcastRequest(attemptId.current, senderId, {
      body: checked.body,
      task,
      tags,
    });

    try {
      const created = await coordination.sendMessage(request);
      const at = new Date().toISOString();
      setSent({ id: created.id ?? request.id, at });
      // Draft is cleared only after confirmation.
      setBody("");
      setTask("");
      setTags("");
      attemptId.current = null;
      announce(`Broadcast ${created.id ?? request.id} sent to the team.`);
      onSent();
    } catch (caught) {
      const failure =
        caught instanceof ApiError ? caught : new ApiError("network_error", String(caught), 0);
      // Everything the operator typed survives; nothing is retried automatically.
      if (requiresNewId(failure.code)) attemptId.current = null;
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <aside
      className="sheet"
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-heading"
    >
      <div className="sheet-header">
        <h2 id="broadcast-heading" ref={heading} tabIndex={-1}>
          Broadcast to team
        </h2>
        <button onClick={requestClose} aria-label="Close broadcast composer" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <form className="sheet-body" onSubmit={submit}>
        {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
        {sent ? (
          <div className="sent-receipt" role="status">
            <p className="sent-title">Broadcast recorded</p>
            <p className="small mono">{sent.id}</p>
            <p className="small muted">{absoluteTime(sent.at)}</p>
          </div>
        ) : null}

        <BroadcastFields
          senderId={senderId}
          senderName={senderName}
          body={body}
          bodyError={bodyError}
          task={task}
          tags={tags}
          onBody={setBody}
          onTask={setTask}
          onTags={setTags}
        />

        <div className="sheet-actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Sending…" : "Send broadcast"}
          </button>
          <button type="button" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
        </div>

        <p className="small muted attribution">
          Writing as <span className="mono">{senderId}</span> in session{" "}
          <span className="mono">{sessionId}</span>. The session is audited, not stored on the
          message.
        </p>
      </form>
    </aside>
  );
}
