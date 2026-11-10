/**
 * Side lists a check treats as complete (UI-86): every page, not the first.
 */

import { describe, expect, it } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import type { Coordination } from "../api/coordination.ts";
import { activeSessions, ListMoving, ListTooLong, openTasks } from "./listQueries.ts";
import { outstandingAssignments } from "./retirement.ts";
import { tasksClaimedBy } from "./staleness.ts";

const task = (index: number, over: Partial<TaskListRow> = {}): TaskListRow =>
  ({
    id: `T-${String(index).padStart(4, "0")}`,
    title: `Task ${index}`,
    status: "todo",
    priority: 2,
    claimed_by: null,
    claim_session_id: null,
    claimed_at: null,
    assignees: [],
    evidence_count: 0,
    ...over,
  }) as TaskListRow;

/** A board that pages by offset in id order and records every request. */
function board(rows: TaskListRow[]) {
  const asked: Record<string, unknown>[] = [];
  const coordination = {
    tasks: (query: Record<string, unknown>) => {
      asked.push(query);
      const offset = Number(query["offset"] ?? 0);
      const limit = Number(query["limit"] ?? 100);
      return Promise.resolve(rows.slice(offset, offset + limit));
    },
    sessions: (query: Record<string, unknown>) => {
      asked.push(query);
      return Promise.resolve([]);
    },
  } as unknown as Coordination;
  return { coordination, asked };
}

describe("openTasks", () => {
  it("sees an old claim and an old assignment past the first 500 open tasks", async () => {
    // The oldest task holds the stale session's claim and david's assignment;
    // 500 newer open tasks follow it.
    const claimed = task(0, { status: "in_progress", claim_session_id: "stale-1", claimed_by: "david", assignees: ["david"] });
    const newer = Array.from({ length: 500 }, (_, index) => task(index + 1));
    const { coordination, asked } = board([claimed, ...newer]);

    const tasks = await openTasks(coordination);

    expect(tasks).toHaveLength(501);
    expect(tasksClaimedBy(tasks, "stale-1").map((row) => row.id)).toEqual(["T-0000"]);
    expect(outstandingAssignments(tasks, "david").map((row) => row.id)).toEqual(["T-0000"]);
    expect(asked.map((query) => query["offset"])).toEqual([0, 499]);
    expect(asked[0]).toMatchObject({ order_by: "id:asc", limit: 500 });
  });

  it("asks once when the first page comes back short", async () => {
    const { coordination, asked } = board([task(1), task(2)]);
    expect(await openTasks(coordination)).toHaveLength(2);
    expect(asked).toHaveLength(1);
  });
});

describe("activeSessions", () => {
  it("asks for active sessions only", async () => {
    const { coordination, asked } = board([]);
    await activeSessions(coordination);
    expect(asked[0]).toMatchObject({ status: "active", order_by: "id:asc", limit: 500, offset: 0 });
  });
});

describe("openTasks while the set changes between pages (UI-88)", () => {
  it("does not skip the boundary task when a task on page one is done before page two", async () => {
    // 501 open tasks; the last holds the stale session's claim. T-0000 is done
    // after page one is read, so every later task shifts up one place.
    let rows = Array.from({ length: 500 }, (_, index) => task(index));
    const claimed = task(500, { status: "in_progress", claim_session_id: "stale-1", claimed_by: "david" });
    rows.push(claimed);
    let reads = 0;
    const coordination = {
      tasks: (query: Record<string, unknown>) => {
        const offset = Number(query["offset"]);
        const page = rows.slice(offset, offset + 500);
        reads += 1;
        if (reads === 1) rows = rows.slice(1);
        return Promise.resolve(page);
      },
    } as unknown as Coordination;

    const tasks = await openTasks(coordination);

    expect(tasksClaimedBy(tasks, "stale-1").map((row) => row.id)).toEqual(["T-0500"]);
    // The read started again, so the done task is not reported.
    expect(tasks.map((row) => row.id)).not.toContain("T-0000");
    expect(tasks).toHaveLength(500);
  });

  it("refuses to answer when the set moves under every attempt", async () => {
    let shift = 0;
    const coordination = {
      tasks: (query: Record<string, unknown>) => {
        const offset = Number(query["offset"]);
        const rows = Array.from({ length: 600 }, (_, index) => task(index + shift));
        shift += 1;
        return Promise.resolve(rows.slice(offset, offset + 500));
      },
    } as unknown as Coordination;
    await expect(openTasks(coordination)).rejects.toBeInstanceOf(ListMoving);
  });
});

describe("openTasks at the ceiling (UI-88)", () => {
  it("reads 49,902 open tasks whole, with the only claim on the last one", async () => {
    const rows = Array.from({ length: 49_901 }, (_, index) => task(index));
    rows.push(task(49_901, { status: "in_progress", claim_session_id: "stale-1", claimed_by: "david" }));
    const { coordination } = board(rows);

    const tasks = await openTasks(coordination);

    expect(tasks).toHaveLength(49_902);
    expect(tasksClaimedBy(tasks, "stale-1")).toHaveLength(1);
  });

  it("reads exactly 50,000 whole, and refuses a longer list", async () => {
    const full = board(Array.from({ length: 50_000 }, (_, index) => task(index)));
    expect(await openTasks(full.coordination)).toHaveLength(50_000);

    const longer = board(Array.from({ length: 50_600 }, (_, index) => task(index)));
    await expect(openTasks(longer.coordination)).rejects.toBeInstanceOf(ListTooLong);
  });
});

describe("openTasks inside a fence over the audit log (UI-90)", () => {
  it("reads again when changes cancel between pages and leave the boundary in place", async () => {
    // 501 open tasks. After page one, T-0000 is done and a reopened task
    // sorts in before the boundary: the boundary row keeps its offset, and
    // the reopened task, which holds the claim, was never read.
    let rows = Array.from({ length: 501 }, (_, index) => task(index + 1));
    let head = 5;
    let reads = 0;
    const coordination = {
      tasks: (query: Record<string, unknown>) => {
        const offset = Number(query["offset"]);
        const page = rows.slice(offset, offset + 500);
        reads += 1;
        if (reads === 1) {
          const reopened = task(0, { id: "T-0001a", status: "in_progress", claim_session_id: "stale-1", claimed_by: "david" });
          rows = [rows[1]!, reopened, ...rows.slice(2)].sort((a, b) => a.id.localeCompare(b.id));
          rows = [task(1), ...rows].slice(1);
          head += 2;
        }
        return Promise.resolve(page);
      },
      summary: () => Promise.resolve({ audit_cursor: head }),
      audit: (query: { since: number }) => Promise.resolve(head > query.since ? [{ id: head }] : []),
    } as unknown as Coordination;

    const tasks = await openTasks(coordination);

    expect(tasksClaimedBy(tasks, "stale-1").map((row) => row.id)).toEqual(["T-0001a"]);
    expect(reads).toBeGreaterThan(2);
  });
});
