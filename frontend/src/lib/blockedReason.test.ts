import { describe, expect, it } from "vitest";
import type { AuditEntry, Dependency } from "../api/contract.ts";
import { blockingCause, blockingRecovery, blockingTaskIds, waitsOn } from "./blockedReason.ts";

const edge = (over: Partial<Dependency>): Dependency => ({
  task_id: "REL-1",
  depends_on_task_id: "SEC-1",
  dependency_type: "blocks",
  status: "active",
  rationale: "",
  created_at: "2026-10-01T00:00:00+00:00",
  ...over,
});

const status = (id: number, detail: string): AuditEntry => ({
  id,
  actor: "david",
  session_id: "s-1",
  action: "status",
  object_type: "task",
  object_id: "REL-1",
  detail,
  created_at: "2026-10-01T00:00:00+00:00",
});

describe("blockingTaskIds", () => {
  it("keeps the task's own active blocks edges and nothing else", () => {
    const ids = blockingTaskIds("REL-1", [
      edge({ depends_on_task_id: "SEC-1" }),
      edge({ depends_on_task_id: "UX-12" }),
      edge({ depends_on_task_id: "UI-62", status: "resolved" }),
      edge({ depends_on_task_id: "UI-26", dependency_type: "informs" }),
      edge({ task_id: "UX-12", depends_on_task_id: "REL-1" }),
    ]);
    expect(ids).toEqual(["SEC-1", "UX-12"]);
  });
});

describe("blockingCause", () => {
  it("reads the cause cited on the most recent move into blocked", () => {
    const cause = blockingCause([
      status(10, "in_progress -> blocked; revision 2 -> 3; because=decision:DEC-OLD"),
      status(20, "blocked -> in_progress; revision 3 -> 4"),
      status(30, "in_progress -> blocked; revision 4 -> 5; because=escalation:ESC-1"),
    ]);
    expect(cause).toEqual({ type: "escalation", id: "ESC-1" });
  });

  it("is null when the move cited nothing, even if an older one did", () => {
    expect(
      blockingCause([
        status(10, "in_progress -> blocked; revision 2 -> 3; because=decision:DEC-OLD"),
        status(30, "in_progress -> blocked; revision 4 -> 5"),
      ]),
    ).toBeNull();
  });

  it("ignores moves out of blocked and rows that are not status changes", () => {
    expect(blockingCause([status(5, "blocked -> done; revision 1 -> 2; because=review:R-1")])).toBeNull();
    expect(blockingCause([{ ...status(6, "x -> blocked; because=review:R-1"), action: "update" }])).toBeNull();
    expect(blockingCause([])).toBeNull();
  });
});

describe("waitsOn", () => {
  it("names each blocker's status as the operator reads it", () => {
    expect(
      waitsOn(["SEC-1", "UX-12", "GONE-1"], [
        { id: "UX-12", status: "review" },
        { id: "SEC-1", status: "todo" },
      ]),
    ).toEqual([
      { id: "SEC-1", status: "to do" },
      { id: "UX-12", status: "in review" },
      { id: "GONE-1", status: null },
    ]);
  });
});

describe("session recovery (softory #14 review)", () => {
  const recovered = (id: number, detail: string): AuditEntry => ({ ...status(id, detail), action: "recover_claim" });
  // Blocked citing ESC-OLD, claimed again, then blocked by session recovery.
  const history = [
    status(10, "todo -> blocked; revision 2 -> 3; because=escalation:ESC-OLD"),
    status(20, "blocked -> in_progress; revision 3 -> 4"),
    recovered(30, "session s-9; in_progress -> blocked; revision 4 -> 5; heartbeat expired"),
  ];

  it("does not carry an earlier cause across a later recovery", () => {
    expect(blockingCause(history)).toBeNull();
    expect(blockingRecovery(history)).toEqual({ session: "s-9", reason: "heartbeat expired" });
  });

  it("reads a cause again once a later status move blocks it", () => {
    const later = [
      ...history,
      status(40, "blocked -> in_progress; revision 5 -> 6"),
      status(50, "in_progress -> blocked; revision 6 -> 7; because=decision:DEC-2"),
    ];
    expect(blockingCause(later)).toEqual({ type: "decision", id: "DEC-2" });
    expect(blockingRecovery(later)).toBeNull();
  });

  it("ignores a recovery that did not move the task into blocked", () => {
    expect(blockingRecovery([recovered(5, "session s-1; in_progress -> todo; revision 1 -> 2; stale")])).toBeNull();
  });
});
