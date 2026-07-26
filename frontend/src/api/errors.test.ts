import { describe, expect, it } from "vitest";
import { ApiError } from "./errors.ts";

describe("ApiError", () => {
  it("carries code, message, status, and details", () => {
    const error = new ApiError("not_found", "gone", 404, { resource: "task" }, 3);
    expect(error.code).toBe("not_found");
    expect(error.status).toBe(404);
    expect(error.details).toEqual({ resource: "task" });
    expect(error.exitCode).toBe(3);
    expect(error).toBeInstanceOf(Error);
  });

  it("recognizes a stale revision conflict", () => {
    const error = new ApiError("stale_task_revision", "stale", 409, { actual_revision: 6 });
    expect(error.isStaleRevision).toBe(true);
    expect(error.actualRevision).toBe(6);
  });

  it("returns undefined for a missing or non-numeric actual revision", () => {
    expect(new ApiError("stale_task_revision", "x", 409).actualRevision).toBeUndefined();
    expect(
      new ApiError("stale_task_revision", "x", 409, { actual_revision: "6" }).actualRevision,
    ).toBeUndefined();
  });

  it("recognizes a missing session", () => {
    expect(new ApiError("session_required", "x", 400).isSessionRequired).toBe(true);
    expect(new ApiError("not_found", "x", 404).isSessionRequired).toBe(false);
  });

  it("recognizes a busy database as retryable", () => {
    expect(new ApiError("database_busy", "x", 503).isBusy).toBe(true);
  });

  it("exposes allowed transitions when the server reports them", () => {
    const error = new ApiError("invalid_task_transition", "no", 409, {
      allowed: ["review", "blocked"],
    });
    expect(error.allowed).toEqual(["review", "blocked"]);
  });

  it("returns undefined allowed when details omit it", () => {
    expect(new ApiError("invalid_task_transition", "no", 409, {}).allowed).toBeUndefined();
  });

  describe("fromPayload", () => {
    it("reads the wire error shape", () => {
      const error = ApiError.fromPayload(
        { ok: false, error: { code: "invalid_actor", message: "no actor", exit_code: 2 } },
        400,
      );
      expect(error.code).toBe("invalid_actor");
      expect(error.message).toBe("no actor");
      expect(error.exitCode).toBe(2);
    });

    it("falls back for an unrecognizable payload", () => {
      const error = ApiError.fromPayload(null, 500);
      expect(error.code).toBe("unexpected_response");
      expect(error.status).toBe(500);
    });

    it("falls back when error is not an object", () => {
      const error = ApiError.fromPayload({ error: "boom" }, 500);
      expect(error.code).toBe("unexpected_response");
    });
  });
});
