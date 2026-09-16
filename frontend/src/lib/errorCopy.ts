/**
 * Error code to operator copy — the one mapping (UI-38, UI-71).
 *
 * Two mappings used to exist: recovery advice under every ErrorBanner, and the
 * assignment panel's own wording. They never overlapped, so nothing was wrong,
 * but the next code would have had to pick a home. This is the home. Every
 * branch is on `code`, never on message text, as the contract requires; the
 * wording each code already had is kept.
 */

export interface CopyContext {
  /** Who or what the error is about, when a code names one (the claim holder). */
  subject?: string;
  /**
   * The surface asking. The assignment panel keeps the sentences it shipped
   * with (UI-38: existing wording stays unless Michael rules otherwise);
   * every other surface gets the general form of the same code.
   */
  surface?: "assign";
}

const COPY: Record<string, (context: CopyContext) => string> = {
  session_required: () => "Start or select an active session in the header, then retry.",
  database_busy: () => "The database was busy. Wait a moment and retry.",
  network_error: () => "Check that `python3 -m coordination_ui` is still running, then retry.",
  invalid_actor: () => "Select an actor in the header, then retry.",
  inactive_actor: () =>
    "This actor is retired and cannot act. Select an active actor in the header.",
  stale_task_revision: () =>
    "This task changed while you were editing. Reload latest; your draft will be preserved.",
  not_found: ({ subject, surface }) =>
    surface === "assign"
      ? `${subject ?? "That agent"} no longer exists as an agent. Refresh the agent list.`
      : `${subject ?? "That record"} no longer exists. Refresh and try again.`,
  task_claim_owner_mismatch: ({ subject, surface }) =>
    surface === "assign"
      ? `${subject ?? "That assignee"} holds the active claim and cannot be removed. ` +
        "Release the claim or recover the session that holds it, then try again."
      : `${subject ?? "Another actor"} holds the active claim, and only the claim holder may ` +
        "change this task while it is claimed. Release the claim or recover the session that " +
        "holds it, then try again.",
  // Widened in 1.4.0 to task assign and task update.
  task_claim_session_mismatch: () =>
    "Another session holds this task's claim. Select the session that claimed it, or recover " +
    "the stale one, then retry.",
  task_not_claimed: () => "This task is not claimed. Claim it before releasing or moving it.",
  status_mismatch: ({ subject }) => `${subject ?? "This record"} changed while you were looking; reload.`,
  already_redacted: () => "This message was already redacted; there is nothing further to remove.",
  cursor_not_monotonic: () => "Your inbox moved on; reload to see the newer position.",
};

/** Every code with mapped copy, for tests that walk the registry. */
export const MAPPED_CODES: readonly string[] = Object.keys(COPY);

export const FALLBACK_COPY = "Review the details below, correct the input, and try again.";

/** Copy for a code; the shared fallback when the code has none. */
export function errorCopy(code: string, context: CopyContext = {}): string {
  const entry = COPY[code];
  return entry ? entry(context) : FALLBACK_COPY;
}

export function hasErrorCopy(code: string): boolean {
  return code in COPY;
}
