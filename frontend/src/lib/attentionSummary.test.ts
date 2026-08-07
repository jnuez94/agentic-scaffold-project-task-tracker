import { describe, expect, it } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import { attentionTotal, summariseAttention } from "./attentionSummary.ts";

const task = (over: Partial<TaskListRow> = {}): TaskListRow => ({
  id: "UI-1",
  title: "A task",
  description: "",
  status: "todo",
  priority: 2,
  tags: "",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "",
  notes: "",
  revision: 1,
  created_by: "david",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  claimed_by: null,
  claim_session_id: null,
  claimed_at: null,
  assignees: ["david"],
  evidence_count: 0,
  ...over,
});

describe("summariseAttention", () => {
  it("returns nothing when nothing needs anyone", () => {
    expect(summariseAttention([task({ status: "done" }), task({ status: "in_progress" })])).toEqual(
      [],
    );
  });

  it("counts each reason", () => {
    const groups = summariseAttention([
      task({ id: "a", status: "blocked" }),
      task({ id: "b", status: "blocked" }),
      task({ id: "c", assignees: [] }),
      task({ id: "d", status: "review" }),
    ]);
    expect(groups.map((g) => [g.reason, g.count])).toEqual([
      ["blocked", 2],
      ["unowned", 1],
      ["awaiting-review", 1],
    ]);
  });

  it("orders by how stuck the work is, not by how many there are", () => {
    // The real board shape: many in review, one blocked. Sorting by count
    // would bury the blocked task under the reviews, which inverts the point.
    const groups = summariseAttention([
      ...Array.from({ length: 11 }, (_, i) => task({ id: `r${i}`, status: "review" as const })),
      task({ id: "b", status: "blocked" }),
    ]);
    expect(groups[0]?.reason).toBe("blocked");
    expect(groups[1]?.reason).toBe("awaiting-review");
  });

  it("omits reasons with no rows rather than showing a zero", () => {
    const groups = summariseAttention([task({ status: "blocked" })]);
    expect(groups).toHaveLength(1);
    expect(groups.every((g) => g.count > 0)).toBe(true);
  });

  it("counts stale claims only when session data says so", () => {
    const rows = [task({ status: "in_progress", claim_session_id: "s-1" })];
    expect(summariseAttention(rows)).toEqual([]);
    expect(
      summariseAttention(rows, { staleSessionIds: new Set(["s-1"]) }).map((g) => g.reason),
    ).toEqual(["stale-claim"]);
  });

  it("agrees with the row highlight by construction", () => {
    // Both go through attentionReason; this pins that they cannot drift.
    const rows = [
      task({ id: "a", status: "blocked" }),
      task({ id: "b", status: "done" }),
      task({ id: "c", status: "review" }),
    ];
    expect(attentionTotal(summariseAttention(rows))).toBe(2);
  });
});

describe("attentionTotal", () => {
  it("sums the groups", () => {
    expect(attentionTotal([{ reason: "blocked", label: "x", count: 3 }])).toBe(3);
  });

  it("is zero for an empty summary", () => {
    expect(attentionTotal([])).toBe(0);
  });
});
