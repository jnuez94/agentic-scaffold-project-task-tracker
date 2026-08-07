import { describe, expect, it } from "vitest";
import { CLEAR_FILTER_HINT, describeThrown, NO_MESSAGES_MATCH, SETUP_PENDING } from "./copy.ts";

describe("shared copy", () => {
  it("keeps the loaded-window qualifier in the filter hint", () => {
    // The console holds only the rows it fetched and the contract gives no
    // total, so "everything" without "loaded" would be a claim it cannot make.
    expect(CLEAR_FILTER_HINT).toContain("loaded");
  });

  it("qualifies the messages empty state as loaded rows", () => {
    expect(NO_MESSAGES_MATCH).toContain("loaded");
  });

  it("describes startup as setup rather than permission", () => {
    // The operator has done nothing wrong and the state resolves on its own.
    expect(SETUP_PENDING).toMatch(/setup/i);
    expect(SETUP_PENDING).not.toMatch(/permission|denied|not allowed/i);
  });
});

describe("describeThrown", () => {
  it("prefers a real Error's own message", () => {
    expect(describeThrown(new Error("connection reset"))).toBe("connection reset");
  });

  it("names the transport for a non-Error rejection", () => {
    // Rather than surfacing [object Object] to the operator.
    expect(describeThrown({ weird: true })).toBe("The console could not reach the local server.");
    expect(describeThrown("a bare string")).toContain("could not reach");
    expect(describeThrown(undefined)).toContain("could not reach");
  });
});
