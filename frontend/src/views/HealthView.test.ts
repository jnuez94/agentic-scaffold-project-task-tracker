import { describe, expect, it } from "vitest";

/**
 * The health payload caps each section at the health limit and names the
 * capped ones in truncated_sections. Rendering a capped length as an exact
 * count understates the finding, which UI-5 forbids.
 */
function countLabel(rows: unknown[], truncated: boolean): string {
  return `${rows.length}${truncated ? "+" : ""}`;
}

describe("health section counts", () => {
  it("shows an exact count when the section is complete", () => {
    expect(countLabel([1, 2, 3], false)).toBe("3");
  });

  it("marks a truncated section rather than claiming an exact count", () => {
    expect(countLabel(new Array(100).fill(0), true)).toBe("100+");
  });

  it("never renders a bare capped number", () => {
    expect(countLabel(new Array(100).fill(0), true)).not.toBe("100");
  });
});
