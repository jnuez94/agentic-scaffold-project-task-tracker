import { describe, expect, it } from "vitest";
import { describeDelta, diffBoards, fingerprint } from "./fingerprint.ts";

const row = (id: string, revision = 1) => ({ id, revision });

describe("fingerprint", () => {
  it("is equal for the same rows at the same revisions", () => {
    expect(fingerprint([row("a"), row("b")])).toBe(fingerprint([row("a"), row("b")]));
  });

  it("ignores order, so a re-sort is not a change", () => {
    // The server orders by priority then updated_at, both of which move when
    // any row is edited — a sorted join would report every row as changed.
    expect(fingerprint([row("a"), row("b")])).toBe(fingerprint([row("b"), row("a")]));
  });

  it("changes when a revision moves", () => {
    expect(fingerprint([row("a", 1)])).not.toBe(fingerprint([row("a", 2)]));
  });

  it("changes when a row is added or removed", () => {
    expect(fingerprint([row("a")])).not.toBe(fingerprint([row("a"), row("b")]));
  });

  it("is stable for an empty set", () => {
    expect(fingerprint([])).toBe(fingerprint([]));
  });
});

describe("diffBoards", () => {
  it("reports nothing when nothing moved", () => {
    const delta = diffBoards([row("a"), row("b")], [row("a"), row("b")]);
    expect(delta).toEqual({ added: [], removed: [], changed: [] });
  });

  it("separates added, changed and removed", () => {
    const delta = diffBoards([row("a", 1), row("gone")], [row("a", 2), row("new")]);
    expect(delta.changed).toEqual(["a"]);
    expect(delta.added).toEqual(["new"]);
    expect(delta.removed).toEqual(["gone"]);
  });

  it("does not call a re-sorted row changed", () => {
    const delta = diffBoards([row("a"), row("b")], [row("b"), row("a")]);
    expect(delta.changed).toEqual([]);
  });
});

describe("describeDelta", () => {
  it("says nothing when nothing changed", () => {
    expect(describeDelta({ added: [], removed: [], changed: [] })).toBe("");
  });

  it("counts rather than saying 'updated'", () => {
    // A bar that says "updated" tells the operator to refresh and nothing else.
    expect(describeDelta({ added: [], removed: [], changed: ["a", "b", "c"] })).toBe(
      "3 tasks changed",
    );
  });

  it("uses the singular for one", () => {
    expect(describeDelta({ added: ["a"], removed: [], changed: [] })).toBe("1 task added");
  });

  it("joins two clauses with and", () => {
    expect(describeDelta({ added: ["a"], removed: [], changed: ["b", "c"] })).toBe(
      "1 task added and 2 tasks changed",
    );
  });

  it("joins three clauses with commas and a final and", () => {
    expect(
      describeDelta({ added: ["a"], removed: ["z"], changed: ["b"] }),
    ).toBe("1 task added, 1 task changed and 1 task no longer listed");
  });
});
