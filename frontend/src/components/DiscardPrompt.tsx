/**
 * "Discard this draft?" — asked when Escape would throw away typed input in
 * an inline form (UI-81). Keep editing is the default and takes focus:
 * Escape is easy to press by accident, and the safe answer should be the one
 * a second Enter gives. Cancel on the form never shows this; pressing it is
 * the explicit choice.
 */

import { useEffect, useId, useRef } from "react";

export function DiscardPrompt({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const titleId = useId();
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
  }, []);

  return (
    <div className="discard-prompt" role="alertdialog" aria-labelledby={titleId}>
      <p id={titleId} className="discard-prompt-title">
        Discard this draft?
      </p>
      <div className="discard-prompt-actions">
        <button ref={keep} type="button" className="primary" onClick={onKeep}>
          Keep editing
        </button>
        <button type="button" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}
