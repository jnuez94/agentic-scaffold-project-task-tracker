import { describe, expect, it } from "vitest";
import type { Message } from "../api/contract.ts";
import {
  dayKey,
  dayLabel,
  groupByDay,
  isOwnMessage,
  loadedCountLabel,
  sortChronologically,
} from "./conversation.ts";

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "MSG-1",
    sender_id: "david",
    recipient: "team",
    task_id: null,
    body: "hello",
    tags: "",
    created_at: "2026-07-26T10:00:00+00:00",
    ...overrides,
  };
}

describe("sortChronologically", () => {
  it("orders ascending by created_at, so the transcript reads top to bottom", () => {
    const rows = [
      message({ id: "c", created_at: "2026-07-26T12:00:00+00:00" }),
      message({ id: "a", created_at: "2026-07-26T09:00:00+00:00" }),
      message({ id: "b", created_at: "2026-07-26T10:00:00+00:00" }),
    ];
    expect(sortChronologically(rows).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks a same-second tie by id, because timestamps are second-resolution", () => {
    const rows = [
      message({ id: "zeta", created_at: "2026-07-26T10:00:00+00:00" }),
      message({ id: "alpha", created_at: "2026-07-26T10:00:00+00:00" }),
    ];
    expect(sortChronologically(rows).map((m) => m.id)).toEqual(["alpha", "zeta"]);
  });

  it("does not mutate the input", () => {
    const rows = [message({ id: "b" }), message({ id: "a" })];
    const snapshot = rows.map((m) => m.id);
    sortChronologically(rows);
    expect(rows.map((m) => m.id)).toEqual(snapshot);
  });

  it("handles an empty list", () => {
    expect(sortChronologically([])).toEqual([]);
  });
});

describe("dayKey", () => {
  it("is stable for two times on the same local day", () => {
    const a = dayKey("2026-07-26T00:30:00Z");
    const b = dayKey("2026-07-26T00:45:00Z");
    expect(a).toBe(b);
  });

  it("returns a sentinel for an unparseable timestamp rather than throwing", () => {
    expect(dayKey("not-a-date")).toBe("unknown");
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 6, 26, 12, 0, 0);

  it("labels the current day Today", () => {
    expect(dayLabel(new Date(2026, 6, 26, 9, 0, 0).toISOString(), now)).toContain("Today");
  });

  it("labels the previous day Yesterday", () => {
    expect(dayLabel(new Date(2026, 6, 25, 9, 0, 0).toISOString(), now)).toContain("Yesterday");
  });

  it("uses a plain date further back", () => {
    const label = dayLabel(new Date(2026, 6, 20, 9, 0, 0).toISOString(), now);
    expect(label).not.toContain("Today");
    expect(label).not.toContain("Yesterday");
  });

  it("always includes the full date, so Today is never ambiguous", () => {
    expect(dayLabel(new Date(2026, 6, 26, 9, 0, 0).toISOString(), now)).toContain("2026");
  });

  it("degrades safely on a bad timestamp", () => {
    expect(dayLabel("nonsense", now)).toBe("Unknown date");
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 6, 26, 12, 0, 0);

  it("groups by local day and keeps groups chronological", () => {
    const rows = [
      message({ id: "today", created_at: new Date(2026, 6, 26, 9).toISOString() }),
      message({ id: "older", created_at: new Date(2026, 6, 24, 9).toISOString() }),
      message({ id: "yesterday", created_at: new Date(2026, 6, 25, 9).toISOString() }),
    ];
    const groups = groupByDay(rows, now);
    expect(groups.map((g) => g.messages.map((m) => m.id))).toEqual([
      ["older"],
      ["yesterday"],
      ["today"],
    ]);
  });

  it("keeps messages inside a group ascending", () => {
    const rows = [
      message({ id: "late", created_at: new Date(2026, 6, 26, 18).toISOString() }),
      message({ id: "early", created_at: new Date(2026, 6, 26, 6).toISOString() }),
    ];
    expect(groupByDay(rows, now)[0]?.messages.map((m) => m.id)).toEqual(["early", "late"]);
  });

  it("returns no groups for no messages", () => {
    expect(groupByDay([], now)).toEqual([]);
  });

  it("loses no message during grouping", () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      message({ id: `m${index}`, created_at: new Date(2026, 6, 20 + (index % 5), 9).toISOString() }),
    );
    const total = groupByDay(rows, now).reduce((sum, g) => sum + g.messages.length, 0);
    expect(total).toBe(25);
  });
});

describe("isOwnMessage", () => {
  it("matches only the acting actor", () => {
    expect(isOwnMessage(message({ sender_id: "david" }), "david")).toBe(true);
    expect(isOwnMessage(message({ sender_id: "mikhail-ux" }), "david")).toBe(false);
  });

  it("is false when no actor is selected", () => {
    expect(isOwnMessage(message(), null)).toBe(false);
  });
});

describe("loadedCountLabel", () => {
  it("says loaded, never total or all", () => {
    const label = loadedCountLabel(19, false);
    expect(label).toBe("19 messages loaded");
    expect(label).not.toMatch(/total|all|of /i);
  });

  it("marks a filtered count", () => {
    expect(loadedCountLabel(3, true)).toBe("3 messages loaded (filtered)");
  });

  it("uses the singular for one", () => {
    expect(loadedCountLabel(1, false)).toBe("1 message loaded");
  });

  it("handles zero", () => {
    expect(loadedCountLabel(0, false)).toBe("0 messages loaded");
  });
});
