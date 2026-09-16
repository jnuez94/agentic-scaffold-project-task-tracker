import { describe, expect, it } from "vitest";
import { errorCopy, FALLBACK_COPY, hasErrorCopy, MAPPED_CODES } from "./errorCopy.ts";

describe("errorCopy", () => {
  it("has a sentence for every mapped code, none of them the fallback", () => {
    for (const code of MAPPED_CODES) {
      const copy = errorCopy(code);
      expect(copy.length).toBeGreaterThan(10);
      expect(copy).not.toBe(FALLBACK_COPY);
    }
  });

  it("covers the codes 1.4.0 added or widened", () => {
    for (const code of [
      "cursor_not_monotonic",
      "already_redacted",
      "task_not_claimed",
      "status_mismatch",
      "task_claim_owner_mismatch",
      "task_claim_session_mismatch",
    ]) {
      expect(hasErrorCopy(code)).toBe(true);
    }
  });

  it("names the subject where a code identifies one", () => {
    expect(errorCopy("task_claim_owner_mismatch", { subject: "alice" })).toMatch(/^alice holds/);
    expect(errorCopy("not_found", { subject: "bob" })).toMatch(/^bob no longer exists/);
  });

  it("keeps the assignment panel's own sentences on that surface", () => {
    expect(errorCopy("task_claim_owner_mismatch", { subject: "david", surface: "assign" })).toBe(
      "david holds the active claim and cannot be removed. Release the claim or recover the " +
        "session that holds it, then try again.",
    );
    expect(errorCopy("not_found", { surface: "assign" })).toBe(
      "That agent no longer exists as an agent. Refresh the agent list.",
    );
  });

  it("falls back for an unmapped code without branching on the message", () => {
    expect(errorCopy("some_new_code")).toBe(FALLBACK_COPY);
    expect(hasErrorCopy("some_new_code")).toBe(false);
  });

  it("keeps the wording the two former maps had", () => {
    expect(errorCopy("session_required")).toBe(
      "Start or select an active session in the header, then retry.",
    );
    expect(errorCopy("stale_task_revision")).toBe(
      "This task changed while you were editing. Reload latest; your draft will be preserved.",
    );
  });
});
