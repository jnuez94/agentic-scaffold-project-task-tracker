import { describe, expect, it } from "vitest";
import {
  humanize,
  initials,
  priorityGlyph,
  priorityLabel,
  splitTags,
  taskStatus,
  toneFor,
} from "./labels.ts";

describe("taskStatus", () => {
  it("gives every status a label, tone, and glyph", () => {
    for (const status of ["todo", "in_progress", "review", "blocked", "done"]) {
      const presentation = taskStatus(status);
      expect(presentation.label).toBeTruthy();
      expect(presentation.glyph).toBeTruthy();
      expect(presentation.tone).toBeTruthy();
    }
  });

  it("uses plain language rather than stored values", () => {
    expect(taskStatus("in_progress").label).toBe("In progress");
    expect(taskStatus("review").label).toBe("In review");
  });

  it("never encodes two states with the same glyph", () => {
    const glyphs = ["todo", "in_progress", "review", "blocked", "done"].map(
      (status) => taskStatus(status).glyph,
    );
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("falls back for an unknown value instead of throwing", () => {
    expect(taskStatus("archived").label).toBe("archived");
  });
});

describe("priority", () => {
  it("labels all five levels", () => {
    expect(priorityLabel(1)).toBe("Highest");
    expect(priorityLabel(3)).toBe("Medium");
    expect(priorityLabel(5)).toBe("Lowest");
  });

  it("falls back for out-of-range values", () => {
    expect(priorityLabel(9)).toBe("Priority 9");
    expect(priorityGlyph(9)).toBe("=");
  });

  it("gives distinct glyphs to distinct levels", () => {
    const glyphs = [1, 2, 3, 4, 5].map(priorityGlyph);
    expect(new Set(glyphs).size).toBe(5);
  });
});

describe("toneFor", () => {
  it("maps outcome-bearing values to meaningful tones", () => {
    expect(toneFor("accepted")).toBe("mint");
    expect(toneFor("rejected")).toBe("coral");
    expect(toneFor("open")).toBe("coral");
    expect(toneFor("resolved")).toBe("mint");
  });

  it("defaults to neutral for unknown values", () => {
    expect(toneFor("something-else")).toBe("neutral");
  });
});

describe("humanize", () => {
  it("turns snake_case into sentence case", () => {
    expect(humanize("closed_no_action")).toBe("Closed no action");
    expect(humanize("review_required")).toBe("Review required");
  });

  it("handles empty input", () => {
    expect(humanize("")).toBe("");
  });
});

describe("initials", () => {
  it("uses the first letter of the first two words", () => {
    expect(initials("Claude Code")).toBe("CC");
  });

  it("uses two letters for a single word", () => {
    expect(initials("David")).toBe("DA");
  });

  it("handles empty and whitespace names", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("splitTags", () => {
  it("splits, trims, and drops empties", () => {
    expect(splitTags("backend, api ,, ui")).toEqual(["backend", "api", "ui"]);
  });

  it("returns an empty array for empty input", () => {
    expect(splitTags("")).toEqual([]);
  });
});
