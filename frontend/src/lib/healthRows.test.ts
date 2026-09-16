import { describe as group, expect, it } from "vitest";
import { asSession, asTask, describe, identify } from "./healthRows.ts";

group("identify", () => {
  it("prefers the record's own id, then the ids a claim row carries", () => {
    expect(identify({ id: "T-1", task_id: "T-9" }, 0)).toBe("T-1");
    expect(identify({ task_id: "T-9", session_id: "s-1" }, 0)).toBe("T-9");
    expect(identify({ session_id: "s-1" }, 0)).toBe("s-1");
  });

  it("falls back to a positional placeholder", () => {
    expect(identify({}, 3)).toBe("row-3");
    expect(identify(null, 0)).toBe("row-0");
  });
});

group("describe", () => {
  it("reads a title, an issue, or a harness, in that order", () => {
    expect(describe({ title: "Do the thing", issue: "x" })).toBe("Do the thing");
    expect(describe({ issue: "Nobody owns it" })).toBe("Nobody owns it");
    expect(describe({ harness: "codex" })).toBe("harness codex");
    expect(describe({ id: "only" })).toBe("");
  });
});

group("asTask and asSession", () => {
  it("recognise only rows that carry what their actions need", () => {
    expect(asTask({ id: "T-1", status: "todo" })?.id).toBe("T-1");
    expect(asTask({ id: "T-1" })).toBeNull();
    expect(asSession({ id: "s-1", last_seen_at: "2026-09-15T00:00:00+00:00" })?.id).toBe("s-1");
    expect(asSession({ id: "s-1" })).toBeNull();
    expect(asSession("s-1")).toBeNull();
  });
});
