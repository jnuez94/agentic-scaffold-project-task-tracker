/**
 * Empty, loading, and error surfaces.
 *
 * Empty states say what is absent and what the operator can do next; they do
 * not celebrate. Errors lead with the recovery step and keep the stable
 * `error.code` visible for diagnosis.
 */

import type { ReactNode } from "react";
import type { ApiError } from "../api/errors.ts";

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {hint ? <p className="small muted">{hint}</p> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-row" key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <span className="skeleton-cell" key={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

function recoveryFor(error: ApiError): string {
  if (error.isSessionRequired) return "Start or select an active session in the header, then retry.";
  if (error.isBusy) return "The database was busy. Wait a moment and retry.";
  if (error.code === "network_error") {
    return "Check that `python3 -m coordination_ui` is still running, then retry.";
  }
  if (error.code === "invalid_actor") return "Select an actor in the header, then retry.";
  return "Review the details below, correct the input, and try again.";
}

export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: ApiError;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <div className="error-body">
        <p className="error-message">{error.message}</p>
        <p className="small muted">{recoveryFor(error)}</p>
        <p className="mono error-code">
          {error.code}
          {error.status ? ` · HTTP ${error.status}` : ""}
        </p>
      </div>
      <div className="error-actions">
        {onRetry ? <button onClick={onRetry}>Retry</button> : null}
        {onDismiss ? (
          <button onClick={onDismiss} aria-label="Dismiss error">
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Polite announcements for screen readers after a successful mutation. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
