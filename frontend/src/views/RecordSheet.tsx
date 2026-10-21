/**
 * The frame a record's sheet forms share (UI-54, UI-82): a modal sheet with a
 * heading, an error line, the acting identity, and the two buttons — so the
 * artifact forms and escalation resolution differ only in their fields and
 * what they send.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../components/icons.tsx";
import { useApp } from "../state/AppContext.tsx";
import { useFocusTrap } from "../state/useFocusTrap.ts";
import { useReturnFocus } from "../state/useReturnFocus.ts";
import { useEscape } from "../state/useEscape.ts";

export function RecordSheet({
  title,
  headingId,
  error,
  conflict,
  blocked,
  pending,
  submitLabel,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  headingId: string;
  error: string | null;
  /** What changed since the record was loaded, shown under a refusal (UI-33). */
  conflict?: ReactNode;
  blocked: string | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { identity, session } = useApp();
  const sheet = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useReturnFocus();
  useFocusTrap(sheet, true);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEscape(() => {
    if (!pending) onClose();
  });

  return (
    <aside className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="sheet-header">
        <h2 id={headingId} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button onClick={() => !pending && onClose()} aria-label="Close" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="sheet-body">
        {error ? (
          <div className="error-banner" role="alert">
            <div>
              <p>{error}</p>
              {conflict}
            </div>
          </div>
        ) : null}

        {children}

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
            aria-describedby={blocked ? `${headingId}-blocked` : undefined}
            onClick={onSubmit}
          >
            {pending ? "Recording…" : submitLabel}
          </button>
          <button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
        </div>
        {blocked ? (
          <p id={`${headingId}-blocked`} className="small muted">
            {blocked}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
