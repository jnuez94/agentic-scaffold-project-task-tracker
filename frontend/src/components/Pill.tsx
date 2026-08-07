/**
 * Status and priority indicators.
 *
 * Every pill pairs a color with a glyph and a text label, so status survives
 * grayscale, color-blindness, and forced-colors mode. Color is never the only
 * carrier of meaning.
 */

import { priorityGlyph, priorityLabel, taskStatus, toneFor, humanize } from "../lib/labels.ts";
import type { Tone } from "../lib/labels.ts";

export function Pill({
  tone,
  glyph,
  label,
  title,
}: {
  tone: Tone;
  glyph?: string;
  label: string;
  title?: string;
}) {
  return (
    <span className={`pill pill-${tone}`} title={title ?? label}>
      {glyph ? (
        <span className="pill-glyph" aria-hidden="true">
          {glyph}
        </span>
      ) : null}
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const presentation = taskStatus(status);
  return (
    <Pill
      tone={presentation.tone}
      glyph={presentation.glyph}
      label={presentation.label}
      title={`Stored value: ${status}`}
    />
  );
}

export function EnumPill({ value }: { value: string }) {
  if (!value) return <span className="muted">—</span>;
  return <Pill tone={toneFor(value)} label={humanize(value)} title={`Stored value: ${value}`} />;
}

export function PriorityTag({ priority }: { priority: number }) {
  const label = priorityLabel(priority);
  return (
    <span className="priority" title={`Priority ${priority} — ${label}`}>
      <span className="priority-glyph" aria-hidden="true">
        {priorityGlyph(priority)}
      </span>
      <span className="mono">{priority}</span>
      <span className="visually-hidden">{`Priority ${priority}, ${label}`}</span>
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="tag-list">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
        </span>
      ))}
    </span>
  );
}

/**
 * Tags as quiet delimited text, for tables.
 *
 * The pill treatment buys scanning by shared vocabulary, and this board has
 * none to scan: 117 distinct tags across 80 tasks, 72 of them used exactly
 * once. Pills were charging the title beside them for an affordance the data
 * cannot support, so tables render text and the inspector keeps the pills
 * (UI-44). One element, so the loaded-row filter still matches the whole set.
 */
export function TagText({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  const all = tags.join(" · ");
  // Clamped to two lines by CSS. Unclamped, a six-tag task wrapped to four
  // lines inside the narrowed column and drove the row to 113px — trading the
  // horizontal noise UI-44 is about for vertical noise, which is worse on a
  // list an operator scans. The full set stays on the title and, per the
  // ruling, fully readable in the inspector.
  return (
    <span className="tag-text" title={all}>
      {all}
    </span>
  );
}
