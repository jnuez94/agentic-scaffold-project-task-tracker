/**
 * "Load older" for a list read newest first (UI-86): the control that sits
 * where a truncation notice used to. Once a page comes back short it states
 * the end of the list rather than implying more.
 */

export function LoadOlder({
  exhausted,
  loading,
  busy = false,
  onLoad,
  announce,
  endLabel = "All loaded",
}: {
  exhausted: boolean;
  /** Reading older rows: the label says so. */
  loading: boolean;
  /** Any read in flight, such as a reload after a filter change: paging waits. */
  busy?: boolean;
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
      disabled={loading || busy}
    >
      {loading ? "Loading older…" : "Load older"}
    </button>
  );
}
