/**
 * The wire error shape, preserved end to end.
 *
 * The CLI contract requires consumers to branch on `code`, never on message
 * text, so the code travels from the CLI through the Python server to here
 * untouched and the UI branches on it.
 */

export interface WireError {
  code: string;
  message: string;
  exit_code?: number;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly exitCode: number | undefined;

  constructor(code: string, message: string, status: number, details?: unknown, exitCode?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.exitCode = exitCode;
  }

  /** A revision conflict: someone else committed between load and submit. */
  get isStaleRevision(): boolean {
    return this.code === "stale_task_revision";
  }

  /** The action needs an active session that the console does not have. */
  get isSessionRequired(): boolean {
    return this.code === "session_required";
  }

  /** The database or an advisory lock was busy; retrying is reasonable. */
  get isBusy(): boolean {
    return this.code === "database_busy";
  }

  /** Revision reported by the server when a stale-revision conflict occurred. */
  get actualRevision(): number | undefined {
    const details = this.details;
    if (details && typeof details === "object" && "actual_revision" in details) {
      const value = (details).actual_revision;
      return typeof value === "number" ? value : undefined;
    }
    return undefined;
  }

  /** Allowed transitions reported alongside an invalid_task_transition. */
  get allowed(): string[] | undefined {
    const details = this.details;
    if (details && typeof details === "object" && "allowed" in details) {
      const value = (details).allowed;
      return Array.isArray(value) ? value.map(String) : undefined;
    }
    return undefined;
  }

  static fromPayload(payload: unknown, status: number): ApiError {
    if (payload && typeof payload === "object" && "error" in payload) {
      const error = (payload as { error: WireError }).error;
      if (error && typeof error === "object") {
        return new ApiError(
          error.code ?? "unknown_error",
          error.message ?? "The coordination CLI reported a failure.",
          status,
          error.details,
          error.exit_code,
        );
      }
    }
    return new ApiError("unexpected_response", `Request failed with status ${status}.`, status);
  }
}
