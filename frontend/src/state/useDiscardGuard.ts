/**
 * Escape on an inline form asks before it discards typed input (UI-81).
 *
 * The house rule comes from the assignee panel: a pending change is not
 * thrown away without asking. With nothing typed, Escape closes at once, as
 * before. While the question is up, Escape answers it the safe way — keep
 * editing — and focus goes back to the field the operator was in. A form
 * that is sending declines Escape altogether, as every sheet does.
 *
 * `isTouched` is asked at the moment of the press rather than passed as a
 * value, so it can read what the form keeps outside its render state.
 */

import { useState } from "react";
import { useEscape } from "./useEscape.ts";

export interface DiscardGuard {
  confirming: boolean;
  keepEditing: () => void;
  discard: () => void;
}

export function useDiscardGuard({
  isTouched,
  pending,
  onDiscard,
}: {
  isTouched: () => boolean;
  pending: boolean;
  onDiscard: () => void;
}): DiscardGuard {
  const [confirming, setConfirming] = useState(false);
  const [resume] = useState<{ field: HTMLElement | null }>(() => ({ field: null }));

  const keepEditing = () => {
    setConfirming(false);
    const field = resume.field;
    // After the prompt has unmounted and taken its focused button with it.
    queueMicrotask(() => {
      if (field?.isConnected) field.focus();
    });
  };

  useEscape(() => {
    if (pending) return;
    if (confirming) {
      keepEditing();
      return;
    }
    if (!isTouched()) {
      onDiscard();
      return;
    }
    const active = document.activeElement;
    resume.field = active instanceof HTMLElement && active !== document.body ? active : null;
    setConfirming(true);
  });

  return { confirming, keepEditing, discard: onDiscard };
}
