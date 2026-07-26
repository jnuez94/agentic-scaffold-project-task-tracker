/**
 * Read-only inspector for one already-loaded Message.
 *
 * Renders the record the table already holds. It issues no query of its own,
 * so opening a message cannot imply a per-task message thread — the CLI has no
 * way to fetch one, and pretending otherwise would be a false affordance.
 *
 * Everything here is read-only by design: schema v1 has no edit, delete,
 * reply, acknowledgement, or read state, so no control offers them.
 */

import { useEffect, useRef } from "react";
import type { Message } from "../api/contract.ts";
import { Field, Tags } from "../components/Fields.tsx";
import { Icon } from "../components/icons.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";

export function MessageInspector({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const { announce } = useApp();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [message.id]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      announce("Message body copied to the clipboard.");
    } catch {
      announce("Copying failed. Select the message text and copy manually.");
    }
  };

  return (
    <aside className="inspector message-inspector" aria-label={`Message ${message.id}`}>
      <button className="inspector-back" onClick={onClose}>
        <Icon name="back" size={16} />
        Back to messages
      </button>

      <div className="inspector-header">
        <div>
          <span className="mono inspector-id">{message.id}</span>
          <h2 className="inspector-title" ref={heading} tabIndex={-1}>
            {message.sender_id} → {message.recipient}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close message" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="inspector-body">
        <Field label="From">
          <span className="mono">{message.sender_id}</span>
        </Field>
        <Field label="To">
          <span className="mono">{message.recipient}</span>
        </Field>
        <Field label="Related task">
          {message.task_id ? (
            <span className="mono">{message.task_id}</span>
          ) : (
            <span className="muted">None</span>
          )}
        </Field>
        <Field label="Tags">
          <Tags value={message.tags} />
        </Field>
        <Field label="Sent">
          <span title={message.created_at}>
            {absoluteTime(message.created_at)} · {relativeTime(message.created_at)}
          </span>
        </Field>

        <div className="field">
          <div className="field-label">Message</div>
          {/* Preserves newlines and wraps unbroken text; never truncated. */}
          <div className="message-body">{message.body}</div>
        </div>

        <button onClick={copyBody}>Copy message body</button>
      </div>
    </aside>
  );
}
