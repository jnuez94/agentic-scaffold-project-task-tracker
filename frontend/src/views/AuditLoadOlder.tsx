/**
 * The control that replaces the audit view's truncation notice (UI-64).
 *
 * The notice used to point at the CLI; now it is the way back. One action,
 * where the notice sat, that appends the next-older page — and, once a page
 * comes back short, states the end of the log rather than implying it.
 */

export function AuditLoadOlder({
  exhausted,
  loading,
  onLoad,
}: {
  exhausted: boolean;
  loading: boolean;
  onLoad: () => void;
}) {
  if (exhausted) {
    return (
      <button type="button" className="link" disabled>
        Beginning of the log
      </button>
    );
  }
  return (
    <button type="button" className="link" onClick={onLoad} disabled={loading}>
      {loading ? "Loading older…" : "Load older"}
    </button>
  );
}
