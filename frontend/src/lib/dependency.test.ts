import { describe, expect, it } from "vitest";
import type { Dependency } from "../api/contract.ts";
import {
  buildDependencyRequest,
  checkDependency,
  orderDependencies,
  type DependencyDraft,
} from "./dependency.ts";

const draft = (over: Partial<DependencyDraft> = {}): DependencyDraft => ({
  dependsOn: "UI-2",
  type: "blocks",
  rationale: "",
  ...over,
});

const dep = (over: Partial<Dependency> = {}): Dependency => ({
  task_id: "UI-1",
  depends_on_task_id: "UI-2",
  dependency_type: "blocks",
  status: "active",
  rationale: "",
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

const context = (over: Partial<Parameters<typeof checkDependency>[1]> = {}) => ({
  taskId: "UI-1",
  existing: [] as Dependency[],
  actorId: "david",
  ...over,
});

describe("checkDependency", () => {
  it("accepts a well-formed dependency", () => {
    expect(checkDependency(draft(), context())).toBeNull();
  });

  it("requires a task to depend on", () => {
    expect(checkDependency(draft({ dependsOn: "   " }), context())?.field).toBe("dependsOn");
  });

  it("refuses a self-dependency", () => {
    const problem = checkDependency(draft({ dependsOn: "UI-1" }), context());
    expect(problem?.message).toContain("cannot depend on itself");
  });

  it("refuses a duplicate of an active dependency", () => {
    const problem = checkDependency(draft(), context({ existing: [dep()] }));
    expect(problem?.message).toContain("already recorded");
  });

  it("allows re-recording one that was resolved", () => {
    // Resolving does not delete the row, so the same pair can legitimately
    // recur; only an active duplicate is a mistake.
    expect(checkDependency(draft(), context({ existing: [dep({ status: "resolved" })] }))).toBeNull();
  });

  it("allows the same task under a different type", () => {
    const existing = [dep({ dependency_type: "informs" })];
    expect(checkDependency(draft({ type: "blocks" }), context({ existing }))).toBeNull();
  });

  it("requires an actor, because this is an attributed change", () => {
    const problem = checkDependency(draft(), context({ actorId: null }));
    expect(problem?.field).toBe("actor");
  });

  it("reports the missing task before the missing actor", () => {
    // Both wrong: the field the operator is looking at wins.
    const problem = checkDependency(draft({ dependsOn: "" }), context({ actorId: null }));
    expect(problem?.field).toBe("dependsOn");
  });
});

describe("buildDependencyRequest", () => {
  it("sends the four required fields", () => {
    const body = buildDependencyRequest(draft(), { taskId: "UI-1", actorId: "david" });
    expect(body).toEqual({ task: "UI-1", depends_on: "UI-2", actor: "david", type: "blocks" });
  });

  it("trims the id rather than sending whitespace the CLI would reject", () => {
    const body = buildDependencyRequest(draft({ dependsOn: "  UI-2 " }), {
      taskId: "UI-1",
      actorId: "david",
    });
    expect(body["depends_on"]).toBe("UI-2");
  });

  it("omits an empty rationale instead of sending a blank string", () => {
    const body = buildDependencyRequest(draft({ rationale: "  " }), {
      taskId: "UI-1",
      actorId: "david",
    });
    expect("rationale" in body).toBe(false);
  });

  it("includes a rationale when given one", () => {
    const body = buildDependencyRequest(draft({ rationale: "waits on the schema" }), {
      taskId: "UI-1",
      actorId: "david",
    });
    expect(body["rationale"]).toBe("waits on the schema");
  });
});

describe("orderDependencies", () => {
  it("puts active dependencies before resolved ones", () => {
    const rows = [
      dep({ depends_on_task_id: "UI-9", status: "resolved" }),
      dep({ depends_on_task_id: "UI-3" }),
    ];
    expect(orderDependencies(rows).map((d) => d.depends_on_task_id)).toEqual(["UI-3", "UI-9"]);
  });

  it("orders by id within a status", () => {
    const rows = [dep({ depends_on_task_id: "UI-9" }), dep({ depends_on_task_id: "UI-3" })];
    expect(orderDependencies(rows).map((d) => d.depends_on_task_id)).toEqual(["UI-3", "UI-9"]);
  });

  it("does not mutate its input", () => {
    const rows = [dep({ depends_on_task_id: "UI-9" }), dep({ depends_on_task_id: "UI-3" })];
    const before = rows.map((d) => d.depends_on_task_id);
    orderDependencies(rows);
    expect(rows.map((d) => d.depends_on_task_id)).toEqual(before);
  });
});
