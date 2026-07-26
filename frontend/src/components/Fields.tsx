/**
 * Read-only presentation of stored text.
 *
 * Stored values are rendered as plain text, never as markup: coordination
 * records are written by other agents, and treating their content as HTML
 * would make one agent's message able to alter another's view.
 */

import type { ReactNode } from "react";
import { splitTags } from "../lib/labels.ts";
import { TagList } from "./Pill.tsx";

export function Field({
  label,
  children,
  hideWhenEmpty = false,
}: {
  label: string;
  children: ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const empty = children === null || children === undefined || children === "";
  if (empty && hideWhenEmpty) return null;
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{empty ? <span className="muted">—</span> : children}</div>
    </div>
  );
}

/** Preserves newlines from stored text without interpreting any markup. */
export function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return <span className="muted">—</span>;
  return <div className="text-block">{text}</div>;
}

export function MetricRow({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="metric-row">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function Tags({ value }: { value: string }) {
  const tags = splitTags(value);
  if (tags.length === 0) return <span className="muted">—</span>;
  return <TagList tags={tags} />;
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>;
}

export function IdCell({ id, title }: { id: string; title?: string }) {
  return (
    <div className="id-cell">
      <span className="mono id-value">{id}</span>
      {title ? <span className="id-title">{title}</span> : null}
    </div>
  );
}
