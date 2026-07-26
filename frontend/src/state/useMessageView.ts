/**
 * The persisted Conversation/Ledger preference as React state.
 */

import { useCallback, useMemo, useState } from "react";
import {
  browserViewPreferenceStore,
  type MessageView,
  type ViewPreferenceStore,
} from "./viewPreference.ts";

export function useMessageView(
  store: ViewPreferenceStore = browserViewPreferenceStore(),
): [MessageView, (view: MessageView) => void] {
  const initial = useMemo(() => store.load(), [store]);
  const [view, setView] = useState<MessageView>(initial);

  const choose = useCallback(
    (next: MessageView) => {
      setView(next);
      store.save(next);
    },
    [store],
  );

  return [view, choose];
}
