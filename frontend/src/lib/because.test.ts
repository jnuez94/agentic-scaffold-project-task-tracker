import { describe, expect, it } from "vitest";
import type { Decision, Escalation, Review } from "../api/contract.ts";
import { autoCause, becauseHref, causeOptions, formatBecause, parseBecause } from "./because.ts";

const review = (id: string, created_at: string, decision = "accepted"): Review =>
  ({ id, task_id: "T-1", reviewer_id: "alice", decision, created_at } as Review);

describe("parseBecause", () => {
  it("lifts a trailing cause out of the detail and keeps the rest", () => {
    expect(parseBecause("in_progress -> review; revision 2 -> 3; because=review:REV-1")).toEqual({
      text: "in_progress -> review; revision 2 -> 3",
      because: { type: "review", id: "REV-1" },
    });
    expect(parseBecause("because=decision:DEC-9")).toEqual({ text: "", because: { type: "decision", id: "DEC-9" } });
  });

  it("finds the cause where the CLI actually writes it, between the transition and the note", () => {
    expect(
      parseBecause("proposed -> superseded; because=decision:BRAND-CLOSED-1; Superseded by BRAND-CLOSED-1: the operator closed branding."),
    ).toEqual({
      text: "proposed -> superseded; Superseded by BRAND-CLOSED-1: the operator closed branding.",
      because: { type: "decision", id: "BRAND-CLOSED-1" },
    });
  });

  it("parses nothing else, and leaves malformed suffixes as text", () => {
    expect(parseBecause("proposed -> accepted; nothing to see")).toEqual({
      text: "proposed -> accepted; nothing to see",
      because: null,
    });
    expect(parseBecause("because=nonsense:X-1").because).toBeNull();
    expect(parseBecause("because=review:").because).toBeNull();
  });
});

describe("formatBecause and becauseHref", () => {
  it("round-trip the contract's spelling and link to the record's inspector", () => {
    const because = { type: "escalation" as const, id: "ESC-1" };
    expect(formatBecause(because)).toBe("escalation:ESC-1");
    expect(becauseHref(because)).toBe("#/escalations/ESC-1");
    expect(becauseHref({ type: "task", id: "UI-7" })).toBe("#/tasks/UI-7");
  });
});

describe("causeOptions", () => {
  const task = { id: "T-1", reviews: [review("REV-1", "2026-09-01T00:00:00+00:00"), review("REV-2", "2026-09-02T00:00:00+00:00", "changes_requested")] };
  const decisions = [
    { id: "DEC-1", title: "About T-1", context: "", decision: "", evidence: "", implications: "" },
    { id: "DEC-2", title: "Unrelated", context: "", decision: "", evidence: "", implications: "" },
  ] as Decision[];
  const escalations = [
    { id: "ESC-1", status: "open", related_tasks: "T-1, T-2" },
    { id: "ESC-2", status: "resolved", related_tasks: "T-1" },
    { id: "ESC-3", status: "open", related_tasks: "T-9" },
  ] as Escalation[];

  it("offers the task's reviews newest first, decisions naming it, and open related escalations", () => {
    expect(causeOptions(task, decisions, escalations).map((option) => option.value)).toEqual([
      "review:REV-2",
      "review:REV-1",
      "decision:DEC-1",
      "escalation:ESC-1",
    ]);
    expect(causeOptions(task, decisions, escalations)[0]!.label).toBe("Review REV-2 — changes requested");
  });
});

describe("autoCause", () => {
  it("cites the latest review when a task leaves review", () => {
    const task = { status: "review" as const, reviews: [review("REV-1", "2026-09-01T00:00:00+00:00"), review("REV-2", "2026-09-02T00:00:00+00:00")] };
    expect(autoCause(task, { kind: "status" })).toEqual({ type: "review", id: "REV-2" });
    expect(autoCause(task, { kind: "release" })).toEqual({ type: "review", id: "REV-2" });
  });

  it("cites nothing for a claim, for other statuses, or without a review", () => {
    const task = { status: "review" as const, reviews: [review("REV-1", "2026-09-01T00:00:00+00:00")] };
    expect(autoCause(task, { kind: "claim" })).toBeNull();
    expect(autoCause({ status: "todo", reviews: task.reviews }, { kind: "status" })).toBeNull();
    expect(autoCause({ status: "review", reviews: [] }, { kind: "status" })).toBeNull();
  });
});
