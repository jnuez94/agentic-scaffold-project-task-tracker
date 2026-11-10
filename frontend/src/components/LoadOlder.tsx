/**
 * "Load older" for a list read newest first (UI-86): the control that sits
 * where a truncation notice used to. Once a page comes back short it states
 * the end of the list rather than implying more.
 */

export function LoadOlder({
  exhausted,
  loading,
  onLoad,
  announce,
  endLabel = "All loaded",
}: {
  exhausted: boolean;
  loading: boolean;
  onLoad: () => void;
  /** The pager's live-region hook, so the grown range is announced. */
  announce?: () => void;
  endLabel?: string;
}) {
  if (exhausted) {
    return (
      <button type="button" className="link" disabled>
        {endLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="link"
      onClick={() => {
        announce?.();
        onLoad();
      }}
      disabled={loading}
    >
      {loading ? "Loading older…" : "Load older"}
    </button>
  );
}
