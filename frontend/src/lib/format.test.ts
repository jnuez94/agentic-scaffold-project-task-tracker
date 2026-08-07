/**
 * Timestamp formatting.
 *
 * These had no tests at all, which is how a seven-day cutoff in `relativeTime`
 * survived to render absolute dates for 82% of a real board (UI-46). The age
 * boundaries are pinned here so a future threshold has to be argued for rather
 * than reintroduced quietly.
 *
 * Every case passes an explicit `now` so the suite does not depend on when it
 * runs, and asserts on shape rather than on a locale-formatted string — the
 * absolute helpers render differently per machine, so pinning exact output
 * would only test the CI box's locale.
 */

import { describe, expect, it } from "vitest";
import { absoluteTime, parseTimestamp, preview, relativeTime } from "./format.ts";

const NOW = new Date("2026-08-06T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("parseTimestamp", () => {
  it("parses a stored UTC timestamp", () => {
    expect(parseTimestamp("2026-08-06T12:00:00Z")?.getTime()).toBe(NOW.getTime());
  });

  it("returns null for absent values rather than an Invalid Date", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseTimestamp("not a date")).toBeNull();
  });
});

describe("relativeTime", () => {
  it("renders an em-dash when there is no timestamp", () => {
    expect(relativeTime(null, NOW)).toBe("—");
    expect(relativeTime("nonsense", NOW)).toBe("—");
  });

  it("reads sub-minute ages as just now", () => {
    expect(relativeTime(ago(0), NOW)).toBe("just now");
    expect(relativeTime(ago(59), NOW)).toBe("just now");
  });

  it("treats a future timestamp as just now rather than a negative age", () => {
    // Clock skew between the CLI's host and the browser is the realistic cause.
    const future = new Date(NOW.getTime() + 90 * 1000).toISOString();
    expect(relativeTime(future, NOW)).toBe("just now");
  });

  it("switches to minutes, hours and days at each boundary", () => {
    expect(relativeTime(ago(60), NOW)).toBe("1m ago");
    expect(relativeTime(ago(59 * 60), NOW)).toBe("59m ago");
    expect(relativeTime(ago(60 * 60), NOW)).toBe("1h ago");
    expect(relativeTime(ago(23 * 3600), NOW)).toBe("23h ago");
    expect(relativeTime(ago(24 * 3600), NOW)).toBe("1d ago");
  });

  it("stays relative past a week — the cutoff UI-46 removed", () => {
    // The old implementation returned a locale date from seven days onward.
    expect(relativeTime(ago(7 * 24 * 3600), NOW)).toBe("7d ago");
    expect(relativeTime(ago(11 * 24 * 3600), NOW)).toBe("11d ago");
  });

  it("stays relative at ages far beyond any board's working life", () => {
    expect(relativeTime(ago(400 * 24 * 3600), NOW)).toBe("400d ago");
  });

  it("never returns a string long enough to wrap the Updated column", () => {
    // The defect was width, so width is what the test asserts. "Jul 25, 2026"
    // is 12 characters; every relative form must beat that.
    for (const seconds of [0, 90, 3600, 24 * 3600, 11 * 24 * 3600, 400 * 24 * 3600]) {
      expect(relativeTime(ago(seconds), NOW).length).toBeLessThanOrEqual(10);
    }
  });
});

describe("absoluteTime", () => {
  it("renders an em-dash when there is no timestamp", () => {
    expect(absoluteTime(null)).toBe("—");
    expect(absoluteTime("nope")).toBe("—");
  });

  it("includes the date and the time, since it exists for precision", () => {
    const rendered = absoluteTime("2026-08-06T12:00:00Z");
    expect(rendered).toMatch(/2026/);
    expect(rendered).toMatch(/\d{2}:\d{2}/);
  });
});

describe("preview", () => {
  it("collapses runs of whitespace onto one line", () => {
    expect(preview("a\n\n  b\tc")).toBe("a b c");
  });

  it("returns short text unchanged", () => {
    expect(preview("short")).toBe("short");
  });

  it("clips to the limit inclusive of the ellipsis", () => {
    const clipped = preview("x".repeat(200), 10);
    expect(clipped).toHaveLength(10);
    expect(clipped.endsWith("…")).toBe(true);
  });
});
