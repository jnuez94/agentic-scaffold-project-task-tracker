/**
 * The audit head read with the records (UI-88): marked on each row read, and
 * absent when the head could not be read.
 */

import { describe, expect, it } from "vitest";
import type { Coordination } from "../api/coordination.ts";
import { ApiError } from "../api/errors.ts";
import { ledgerFence, readMarked, readOneMarked, watermarkOf } from "./auditWatermark.ts";

/**
 * A ledger whose head the test scripts. `since` answers from the head that
 * the next summary read would give, as the audit log would.
 */
function source(head: () => Promise<number>) {
  const order: string[] = [];
  const coordination = {
    summary: () => {
      order.push("head");
      return head().then((audit_cursor) => ({ audit_cursor }));
    },
    audit: (query: { since: number }) => {
      order.push("since");
      return head().then((now) => (now > query.since ? [{ id: now }] : []));
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
    expect(order).toEqual(["head", "rows", "since"]);
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

describe("ledgerFence.quietSince (UI-91)", () => {
  it("asks for a complete scan, so an empty answer is proof", async () => {
    const queries: unknown[] = [];
    const coordination = {
      audit: (query: unknown) => {
        queries.push(query);
        return Promise.resolve([]);
      },
    } as unknown as Coordination;
    expect(await ledgerFence(coordination).quietSince(5)).toBe(true);
    expect(queries).toEqual([{ since: 5, exclude_action: "heartbeat", limit: 1, complete: true }]);
  });

  it("is not quiet when the scan could not reach the end of the log", async () => {
    // 10,000 heartbeats and then an update: the server refuses to call that empty.
    const coordination = {
      audit: () => Promise.reject(new ApiError("audit_scan_incomplete", "too long", 503)),
    } as unknown as Coordination;
    expect(await ledgerFence(coordination).quietSince(5)).toBe(false);
  });

  it("does not mark rows read behind a backlog the scan could not finish", async () => {
    const coordination = {
      summary: () => Promise.resolve({ audit_cursor: 5 }),
      audit: () => Promise.reject(new ApiError("audit_scan_incomplete", "too long", 503)),
    } as unknown as Coordination;
    const rows = await readMarked(coordination, () => Promise.resolve([{ id: "T-1" }]));
    expect(watermarkOf(rows[0]!)).toBeUndefined();
  });
});
