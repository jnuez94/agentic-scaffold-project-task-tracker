/**
 * The audit head read with the records (UI-88): marked on each row read, and
 * absent when the head could not be read.
 */

import { describe, expect, it } from "vitest";
import type { Coordination } from "../api/coordination.ts";
import { readMarked, readOneMarked, watermarkOf } from "./auditWatermark.ts";

function source(head: () => Promise<number>) {
  const order: string[] = [];
  const coordination = {
    summary: () => {
      order.push("head");
      return head().then((audit_cursor) => ({ audit_cursor }));
    },
  } as unknown as Coordination;
  return { coordination, order };
}

describe("readMarked", () => {
  it("reads the head before the records and marks every row with it", async () => {
    const { coordination, order } = source(() => Promise.resolve(42));
    const rows = await readMarked(coordination, () => {
      order.push("rows");
      return Promise.resolve([{ id: "A" }, { id: "B" }]);
    });
    expect(order).toEqual(["head", "rows"]);
    expect(rows.map((row) => watermarkOf(row))).toEqual([42, 42]);
  });

  it("leaves rows unmarked when the head cannot be read", async () => {
    const { coordination } = source(() => Promise.reject(new Error("offline")));
    const rows = await readMarked(coordination, () => Promise.resolve([{ id: "A" }]));
    expect(watermarkOf(rows[0]!)).toBeUndefined();
  });

  it("marks one record read by id", async () => {
    const { coordination } = source(() => Promise.resolve(7));
    const row = await readOneMarked(coordination, () => Promise.resolve({ id: "ESC-1" }));
    expect(watermarkOf(row)).toBe(7);
  });
});
