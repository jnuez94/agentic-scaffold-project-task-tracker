import { describe, expect, it } from "vitest";
import { isEmptyValue, visibleFields, type OrderedField } from "./inspectorFields.ts";

const FIELDS: OrderedField[] = [
  { key: "blocked_claims", label: "What this does not authorise", constraint: true },
  { key: "decision", label: "Decision" },
  { key: "context", label: "Context" },
];

describe("isEmptyValue", () => {
  it("treats null, undefined, blank strings and empty arrays as absent", () => {
    for (const value of [null, undefined, "", "   ", []]) {
      expect(isEmptyValue(value)).toBe(true);
    }
  });

  it("treats real content as present, including zero and false", () => {
    // A numeric zero is a value, not an absence — dropping it would silently
    // hide a legitimate record field.
    for (const value of ["text", 0, false, ["a"]]) {
      expect(isEmptyValue(value)).toBe(false);
    }
  });
});

describe("visibleFields", () => {
  it("puts constraint fields first regardless of declaration order", () => {
    const ordered = visibleFields(
      [{ key: "decision", label: "Decision" }, ...FIELDS.slice(0, 1)],
      { decision: "ship it", blocked_claims: "not a security review" },
    );
    expect(ordered[0]!.key).toBe("blocked_claims");
  });

  it("keeps a constraint field even when empty", () => {
    // "We did not limit this" is a statement an operator needs; dropping it
    // makes an unbounded record look identical to a bounded one.
    const ordered = visibleFields(FIELDS, { decision: "ship it" });
    expect(ordered.map((f) => f.key)).toEqual(["blocked_claims", "decision"]);
  });

  it("drops empty descriptive fields rather than printing blank labels", () => {
    const ordered = visibleFields(FIELDS, {
      blocked_claims: "scope only",
      decision: "ship it",
      context: "   ",
    });
    expect(ordered.map((f) => f.key)).toEqual(["blocked_claims", "decision"]);
  });

  it("renders every field when all are populated", () => {
    const ordered = visibleFields(FIELDS, {
      blocked_claims: "scope only",
      decision: "ship it",
      context: "background",
    });
    expect(ordered).toHaveLength(3);
  });

  it("preserves relative order among descriptive fields", () => {
    const ordered = visibleFields(FIELDS, {
      blocked_claims: "x",
      decision: "d",
      context: "c",
    });
    expect(ordered.map((f) => f.key)).toEqual(["blocked_claims", "decision", "context"]);
  });
});
