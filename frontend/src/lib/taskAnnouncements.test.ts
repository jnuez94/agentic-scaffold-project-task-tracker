import { describe, expect, it } from "vitest";
import type { Mutated } from "../api/client.ts";
import {
  claimAnnouncement,
  REAPED_SENTENCE,
  transitionAnnouncement,
  type ClaimResult,
  type TransitionResult,
} from "./taskAnnouncements.ts";

const claimed = (result: Mutated<ClaimResult>) => result;
const moved = (result: Mutated<TransitionResult>) => result;

describe("claimAnnouncement", () => {
  it("reads the revision from the response and names the receipt", () => {
    expect(
      claimAnnouncement(
        "T-1",
        claimed({ revision: 5, status: "in_progress", audit_range: [1806, 1806] }),
      ),
    ).toBe("T-1 claimed at revision 5. Recorded as audit 1806.");
  });

  it("says when the claim took over a silent session, with the response's revision", () => {
    // Reaping ends a session and takes the claim: two audit rows, revision up by two.
    const text = claimAnnouncement(
      "T-1",
      claimed({
        revision: 6,
        status: "in_progress",
        reaped_session: "old-session",
        audit_range: [1806, 1807],
      }),
    );
    expect(text).toBe(`T-1 claimed at revision 6.${REAPED_SENTENCE} Recorded as audit 1806–1807.`);
  });

  it("invents no receipt when the response carries none", () => {
    expect(claimAnnouncement("T-1", { revision: 5, status: "in_progress" })).toBe(
      "T-1 claimed at revision 5.",
    );
  });
});

describe("transitionAnnouncement", () => {
  it("names the cause when the change cites one", () => {
    expect(
      transitionAnnouncement("T-1", "blocked", moved({ revision: 3, status: "blocked" }), { type: "review", id: "REV-1" }),
    ).toBe("T-1 moved to blocked at revision 3. Because of review REV-1.");
  });

  it("names target, revision from the response, and the receipt", () => {
    expect(
      transitionAnnouncement("T-1", "review", moved({ revision: 3, status: "review", audit_range: [9, 9] })),
    ).toBe("T-1 moved to review at revision 3. Recorded as audit 9.");
  });
});
