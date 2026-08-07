/**
 * What needs someone, sitting directly above the queue it describes (UI-42).
 *
 * The console had no surface answering the question a person opens it with:
 * the one that knew — Health — was the tenth item in the navigation, below
 * Export. This does not move Health, and deliberately is not a second copy of
 * it. It is one line of counts over the rows already on screen, and each count
 * filters the list beneath it, so noticing and acting are one motion.
 *
 * Held to a line on purpose. UX-SCOPE-2 rejected an Attention workspace, and
 * the way that decision gets quietly reversed is by a strip growing tiles,
 * then trends, then its own route. No history, no sparkline, no detail: if a
 * reader wants more than a count they click it and read the actual rows.
 */

import type { AttentionReason } from "../lib/attention.ts";
import { SHORT_LABELS, type AttentionGroup } from "../lib/attentionSummary.ts";

export function AttentionBar({
  groups,
  total,
  active,
  onSelect,
  scopeHint,
}: {
  groups: readonly AttentionGroup[];
  total: number;
  /** The reason currently narrowing the queue, if any. */
  active: AttentionReason | null;
  onSelect: (reason: AttentionReason | null) => void;
  /** Named when the counts describe a narrower set than the whole board. */
  scopeHint?: string;
}) {
  // Nothing needing anyone is a real answer, and worth stating plainly rather
  // than by absence — an empty space says "not loaded" as easily as "clear".
  if (total === 0) {
    return (
      <div className="attention-bar clear" role="status">
        <span className="attention-glyph" aria-hidden="true">
          ✓
        </span>
        <p className="attention-lead">Nothing is waiting on anyone.</p>
        {scopeHint ? <span className="small muted">{scopeHint}</span> : null}
      </div>
    );
  }

  return (
    <div className="attention-bar" role="group" aria-label="Work needing attention">
      <span className="attention-glyph" aria-hidden="true">
        !
      </span>
      <p className="attention-lead">
        <strong>{total}</strong> {total === 1 ? "task needs" : "tasks need"} someone
      </p>
      <div className="attention-groups">
        {groups.map((group) => {
          const selected = active === group.reason;
          return (
            <button
              key={group.reason}
              type="button"
              className={selected ? "attention-chip active" : "attention-chip"}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : group.reason)}
            >
              <span className="attention-count">{group.count}</span>
              <span>{SHORT_LABELS[group.reason]}</span>
            </button>
          );
        })}
      </div>
      {active ? (
        <button type="button" className="attention-clear" onClick={() => onSelect(null)}>
          Show all
        </button>
      ) : null}
      {scopeHint ? <span className="small muted attention-scope">{scopeHint}</span> : null}
    </div>
  );
}
