import { describe, expect, it } from "vitest";
import { formatAge, timeInStateLine } from "./timeInState.ts";

describe("formatAge", () => {
  it("rounds down into the largest unit that fits", () => {
    expect(formatAge(30)).toBe("under a minute");
    expect(formatAge(60)).toBe("1 minute");
    expect(formatAge(59 * 60)).toBe("59 minutes");
    expect(formatAge(3600)).toBe("1 hour");
    expect(formatAge(86_399)).toBe("23 hours");
    expect(formatAge(4_462_361)).toBe("51 days");
  });
});

describe("timeInStateLine", () => {
  it("names each open status with a count in lifecycle order, skipping empty ones", () => {
    const line = timeInStateLine({
      blocked: { count: 1, oldest_seconds: 4_399_259, average_seconds: 4_399_259 },
      in_progress: { count: 0, oldest_seconds: 0, average_seconds: 0 },
      review: { count: 18, oldest_seconds: 4_462_361, average_seconds: 570_839 },
      todo: { count: 17, oldest_seconds: 4_511_784, average_seconds: 3_434_784 },
    });
    expect(line).toBe("To do: 17, oldest 52 days · In review: 18, oldest 51 days · Blocked: 1, oldest 50 days");
  });

  it("is empty with nothing open, or nothing fetched", () => {
    expect(timeInStateLine(undefined)).toBe("");
    expect(timeInStateLine({ todo: { count: 0, oldest_seconds: 0, average_seconds: 0 } })).toBe("");
  });
});
