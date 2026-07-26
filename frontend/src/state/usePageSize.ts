/**
 * The remembered rows-per-page for one table.
 */

import { useCallback, useMemo, useState } from "react";
import type { PageSize } from "../lib/pagination.ts";
import { browserPageSizeStore, type PageSizeStore } from "./pageSizeStore.ts";

export function usePageSize(
  tableId: string,
  store: PageSizeStore = browserPageSizeStore(),
): [PageSize, (size: PageSize) => void] {
  const initial = useMemo(() => store.load(tableId), [store, tableId]);
  const [size, setSize] = useState<PageSize>(initial);

  const choose = useCallback(
    (next: PageSize) => {
      setSize(next);
      store.save(tableId, next);
    },
    [store, tableId],
  );

  return [size, choose];
}
