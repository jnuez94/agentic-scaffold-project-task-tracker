import { describe, expect, it } from "vitest";
import { auditRangeOf, receiptSuffix } from "./receipt.ts";

describe("receipt", () => {
  it("reads a well-formed audit range and nothing else", () => {
    expect(auditRangeOf({ revision: 2, audit_range: [1806, 1806] })).toEqual([1806, 1806]);
    expect(auditRangeOf({ revision: 2 })).toBeNull();
    expect(auditRangeOf({ audit_range: [1806] })).toBeNull();
    expect(auditRangeOf({ audit_range: ["a", "b"] })).toBeNull();
    expect(auditRangeOf(null)).toBeNull();
    expect(auditRangeOf("1806")).toBeNull();
  });

  it("names one id or a range, and stays silent without a receipt", () => {
    expect(receiptSuffix({ audit_range: [1806, 1806] })).toBe(" Recorded as audit 1806.");
    expect(receiptSuffix({ audit_range: [1806, 1808] })).toBe(" Recorded as audit 1806–1808.");
    expect(receiptSuffix({ id: "T-1" })).toBe("");
    expect(receiptSuffix(undefined)).toBe("");
  });
});
