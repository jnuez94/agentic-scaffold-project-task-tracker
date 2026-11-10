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
    expect(order).toEqual(["head", "rows", "head"]);
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

  it("reads again when a write commits between the head and the records", async () => {
    // Head 9 is read, correction 10 commits, and the record read shows it.
    // Marking that row 9 would list correction 10 as a change since.
    const heads = [9, 10, 10, 10];
    const { coordination } = source(() => Promise.resolve(heads.shift()!));
    let reads = 0;
    const rows = await readMarked(coordination, () => {
      reads += 1;
      return Promise.resolve([{ id: "ART-1", type: "spec" }]);
    });
    expect(reads).toBe(2);
    expect(watermarkOf(rows[0]!)).toBe(10);
  });

  it("leaves rows unmarked when the ledger moves under every attempt", async () => {
    let head = 0;
    const { coordination } = source(() => Promise.resolve((head += 1)));
    const rows = await readMarked(coordination, () => Promise.resolve([{ id: "A" }]));
    expect(watermarkOf(rows[0]!)).toBeUndefined();
  });
});
