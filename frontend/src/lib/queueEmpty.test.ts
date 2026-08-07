import { describe, expect, it } from "vitest";
import { queueEmptyState } from "./queueEmpty.ts";
import { ALL_SCOPE, OPEN_SCOPE } from "../state/queueScopeStore.ts";

const state = (over: Partial<Parameters<typeof queueEmptyState>[0]> = {}) =>
  queueEmptyState({
    scope: OPEN_SCOPE,
    filtered: false,
    byAssignee: false,
    loadedCount: 0,
    ...over,
  });

describe("queueEmptyState", () => {
  it("names the remembered scope when it is the only reason the table is empty", () => {
    // The failure this guards: a choice made weeks ago silently hiding work.
    const copy = state({ scope: OPEN_SCOPE, loadedCount: 47 });
    expect(copy.title).toBe("No open work");
    expect(copy.hint).toContain("47");
    expect(copy.hint).toContain("All states");
  });

  it("reads naturally when exactly one task is loaded", () => {
    expect(state({ loadedCount: 1 }).hint).toContain("1 loaded task is done");
  });

  it("uses the plural for more than one", () => {
    expect(state({ loadedCount: 2 }).hint).toContain("2 loaded tasks are done");
  });

  it("blames the filter when one is applied, not the scope", () => {
    const copy = state({ loadedCount: 47, filtered: true });
    expect(copy.title).toBe("No tasks match these filters");
  });

  it("blames the filters when an assignee is chosen", () => {
    expect(state({ loadedCount: 47, byAssignee: true }).title).toBe(
      "No tasks match these filters",
    );
  });

  it("names a specific status scope", () => {
    const copy = state({ scope: "blocked", loadedCount: 0 });
    expect(copy.title).toBe("No tasks are blocked");
  });

  it("falls back to the first-run message when nothing is loaded at all", () => {
    expect(state({ scope: ALL_SCOPE, loadedCount: 0 }).title).toBe("No tasks yet");
  });

  it("does not claim open work is missing when nothing was loaded", () => {
    // Zero loaded rows means the board is empty, not that it is all done.
    expect(state({ scope: OPEN_SCOPE, loadedCount: 0 }).title).toBe("No tasks yet");
  });
});
