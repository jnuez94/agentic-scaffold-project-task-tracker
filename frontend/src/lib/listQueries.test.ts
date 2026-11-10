/**
 * Side lists a check treats as complete (UI-86): every page, not the first.
 */

import { describe, expect, it } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import type { Coordination } from "../api/coordination.ts";
import { activeSessions, openTasks } from "./listQueries.ts";
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
    expect(asked.map((query) => query["offset"])).toEqual([0, 500]);
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
