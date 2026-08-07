import { describe, expect, it } from "vitest";
import type { TaskListRow } from "../api/contract.ts";
import { attentionCount, attentionReason, needsAttention } from "./attention.ts";

type Subject = Pick<TaskListRow, "status" | "assignees" | "claim_session_id">;

const task = (over: Partial<Subject> = {}): Subject => ({
  status: "todo",
  assignees: ["david"],
  claim_session_id: null,
  ...over,
});

describe("attentionReason", () => {
  it("ignores done work whatever else is true of it", () => {
    // Done is the exclusion every other clause would otherwise have to repeat.
    expect(attentionReason(task({ status: "done", assignees: [] }))).toBeNull();
  });

  it("flags blocked tasks", () => {
    expect(attentionReason(task({ status: "blocked" }))).toBe("blocked");
  });

  it("flags unowned tasks that are not done", () => {
    expect(attentionReason(task({ assignees: [] }))).toBe("unowned");
  });

  it("does not flag an unowned task that is done", () => {
    expect(attentionReason(task({ assignees: [], status: "done" }))).toBeNull();
  });

  it("flags a task in review, where someone owes a disposition", () => {
    expect(attentionReason(task({ status: "review" }))).toBe("awaiting-review");
  });

  it("flags a claim held by a stale session", () => {
    const reason = attentionReason(task({ status: "in_progress", claim_session_id: "s-1" }), {
      staleSessionIds: new Set(["s-1"]),
    });
    expect(reason).toBe("stale-claim");
  });

  it("leaves a claim held by a live session alone", () => {
    const reason = attentionReason(task({ status: "in_progress", claim_session_id: "s-1" }), {
      staleSessionIds: new Set(["s-9"]),
    });
    expect(reason).toBeNull();
  });

  it("stays quiet rather than wrong when sessions have not loaded", () => {
    // Absent session data must under-report, never over-report.
    expect(attentionReason(task({ status: "in_progress", claim_session_id: "s-1" }))).toBeNull();
  });

  it("does not flag ordinary owned work in progress", () => {
    expect(needsAttention(task({ status: "in_progress" }))).toBe(false);
    expect(needsAttention(task({ status: "todo" }))).toBe(false);
  });

  it("prefers blocked over unowned when both are true", () => {
    // Blocked is the more specific and more actionable statement.
    expect(attentionReason(task({ status: "blocked", assignees: [] }))).toBe("blocked");
  });
});

describe("attentionCount", () => {
  it("counts only the rows that need attention", () => {
    const rows = [
      task({ status: "done" }),
      task({ status: "blocked" }),
      task({ assignees: [] }),
      task({ status: "in_progress" }),
      task({ status: "review" }),
    ];
    expect(attentionCount(rows)).toBe(3);
  });

  it("lands well under half the board, which is the point of the definition", () => {
    // Not-done was rejected at 41% because the eye stops distinguishing there.
    const board = [
      ...Array.from({ length: 47 }, () => task({ status: "done" })),
      ...Array.from({ length: 20 }, () => task({ status: "in_progress" })),
      ...Array.from({ length: 8 }, () => task({ status: "review" })),
      ...Array.from({ length: 3 }, () => task({ status: "blocked" })),
    ];
    const share = attentionCount(board) / board.length;
    expect(share).toBeLessThan(0.25);
    expect(share).toBeGreaterThan(0.05);
  });

  it("counts nothing on an empty board", () => {
    expect(attentionCount([])).toBe(0);
  });
});
