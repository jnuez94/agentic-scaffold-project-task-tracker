/**
 * The remembered queue scope, following the usePageSize shape.
 */

import { useCallback, useMemo, useState } from "react";
import {
  browserQueueScopeStore,
  QueueScopeStore,
  type QueueScope,
} from "./queueScopeStore.ts";

export function useQueueScope(
  store: QueueScopeStore = browserQueueScopeStore(),
): [QueueScope, (scope: QueueScope) => void] {
  const initial = useMemo(() => store.load(), [store]);
  const [scope, setScope] = useState<QueueScope>(initial);

  const choose = useCallback(
    (next: QueueScope) => {
      setScope(next);
      store.save(next);
    },
    [store],
  );

  return [scope, choose];
}
