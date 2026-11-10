/**
 * The last audit row reflected in a record the operator is looking at, for
 * "Since you loaded it" (UI-87).
 *
 * The status boundary used the row's `updated_at`, but the CLI stamps that
 * before it takes the write lock and stamps the audit row after, so a change
 * already shown could carry a later second than the snapshot and read as a
 * change since. An audit id has no clock in it: every row after it is a
 * change the operator has not seen.
 *
 * The id is read coherently when a form opens: the record's newest audit id,
 * the record by id, and the newest audit id again. The pair must agree (no
 * write landed between them) and the record read must match the record
 * displayed (nothing changed between showing it and opening the form). When
 * either fails after a few tries, nothing is returned and the caller keeps the
 * timestamp boundary.
 */

import { useEffect, useState } from "react";
import { useApp } from "./AppContext.tsx";

const ATTEMPTS = 3;

/** True when every field both rows carry is equal. */
export function sameRecord(shown: Record<string, unknown>, read: Record<string, unknown>): boolean {
  return Object.keys(shown)
    .filter((key) => key in read)
    .every((key) => JSON.stringify(shown[key]) === JSON.stringify(read[key]));
}

export function useLoadedWatermark(
  objectType: string,
  route: string,
  shown: { id: string } & object,
): number | undefined {
  const { coordination } = useApp();
  const [watermark, setWatermark] = useState<number | undefined>(undefined);
  // Read once per opened form: the record shown is the one the form was opened on.
  const [opened] = useState(shown);

  useEffect(() => {
    let cancelled = false;
    const newest = () =>
      coordination
        .audit({ object_type: objectType, object_id: opened.id, limit: 1 })
        .then((rows) => rows[0]?.id ?? 0);
    void (async () => {
      for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        const before = await newest();
        const read = await coordination.show(route, opened.id);
        const after = await newest();
        if (cancelled) return;
        if (before !== after) continue;
        if (sameRecord(opened, read)) setWatermark(before);
        return;
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [coordination, objectType, route, opened]);

  return watermark;
}
