import { describe, expect, it } from "vitest";
import type { Decision } from "../api/contract.ts";
import {
  buildRulingRequest,
  DECISION_STATUSES,
  rulingAnnouncement,
  rulingBlockedReason,
} from "./decisionRuling.ts";

const decision = {
  id: "DEC-1",
  title: "Adopt the ledger",
  owner_id: "alice",
  status: "proposed",
} as Decision;

describe("rulingBlockedReason", () => {
  it("needs a status, a different one, and a note — in that order", () => {
    expect(rulingBlockedReason(decision, { status: "", note: "" })).toMatch(/Choose the status/);
    expect(rulingBlockedReason(decision, { status: "proposed", note: "x" })).toBe("It is already proposed.");
    expect(rulingBlockedReason(decision, { status: "accepted", note: "   " })).toMatch(/Say why/);
    expect(rulingBlockedReason(decision, { status: "accepted", note: "Confirmed." })).toBeNull();
  });
});

describe("buildRulingRequest", () => {
  it("sends the loaded status as if_status and trims the note", () => {
    expect(buildRulingRequest(decision, { status: "superseded", note: "  By DEC-2.  " }, "david")).toEqual({
      status: "superseded",
      actor: "david",
      if_status: "proposed",
      note: "By DEC-2.",
    });
  });
});

describe("rulingAnnouncement", () => {
  it("names the transition and the receipt", () => {
    expect(
      rulingAnnouncement({ id: "DEC-1", previous_status: "proposed", status: "accepted", audit_range: [9, 9] } as never),
    ).toBe("DEC-1 is now accepted, was proposed. Recorded as audit 9.");
  });
});

describe("DECISION_STATUSES", () => {
  it("is the contract's four", () => {
    expect([...DECISION_STATUSES]).toEqual(["proposed", "accepted", "superseded", "rejected"]);
  });
});
