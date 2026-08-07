/**
 * Read-only inspector for one already-loaded governance record (UI-29).
 *
 * Renders the row the table already holds and issues no request. That is a
 * constraint rather than an optimisation: `task` is the only entity with a
 * `show` command, so an inspector that fetched would be promising detail the
 * CLI cannot supply. MessageInspector established the pattern; this extends it
 * across the six entities that have tables.
 *
 * Read-only throughout. Schema v1 offers no edit or delete for these records,
 * so no control implies one. The exceptions are state transitions the CLI
 * already supports and they arrive as `actions` from the caller rather than
 * being invented here.
 *
 * Spec: docs/ux-entity-inspectors-spec.md
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Field, MetricRow, Tags } from "../components/Fields.tsx";
import { Icon } from "../components/icons.tsx";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { text } from "../lib/rowValue.ts";
import {
  isEmptyValue,
  visibleFields,
  type FieldSpec,
  type InspectorConfig,
  type Row,
} from "./inspectorConfigs.tsx";

export function RecordInspector({
  config,
  row,
  onClose,
  actions,
}: {
  config: InspectorConfig;
  row: Row;
  onClose: () => void;
  /** State transitions the CLI supports, supplied by the route. */
  actions?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const id = text(row["id"]);

  useEffect(() => {
    heading.current?.focus();
  }, [id]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = config.titleKey ? text(row[config.titleKey]) : "";

  return (
    <aside className="inspector record-inspector" aria-label={`${config.kind} ${id}`}>
      <button className="inspector-back" onClick={onClose}>
        <Icon name="back" size={16} />
        Back to list
      </button>

      <div className="inspector-header">
        <div>
          <span className="small muted inspector-kind">{config.kind}</span>
          <span className="mono inspector-id">{id}</span>
          <h2 className="inspector-title" ref={heading} tabIndex={-1}>
            {title || id}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close inspector" className="close">
          <Icon name="close" size={16} />
        </button>
      </div>

      <MetricRow
        items={config.metrics.map((metric) => ({
          label: metric.label,
          value: renderValue(row[metric.key], metric.kind) || <span className="muted">—</span>,
        }))}
      />

      {/* Focusable so a keyboard user can scroll it, which a plain div is not.
          Given focus, it must also say what it is: a bare tabbable div announces
          nothing on arrival. role plus a name makes it a real region rather than
          a focus stop with no explanation. */}
      <div
        className="inspector-body"
        tabIndex={0}
        role="region"
        aria-label={`${config.kind} details`}
      >
        {visibleFields(config.fields, row).map((field) => (
          <Field
            key={field.key}
            label={field.label}
            className={field.constraint ? "constraint-field" : undefined}
          >
            {renderField(field, row[field.key])}
          </Field>
        ))}

      </div>

      {/* Outside the scrolling body on purpose. These act on the record, and
          inside the body they scrolled away with the fields — the same defect
          that made the reassignment panel's Save button look absent. Pinned
          between the body and the footer, they stay reachable however long the
          record is. */}
      {actions ? <div className="inspector-actions">{actions}</div> : null}

      <footer className="inspector-footer small muted">
        {config.footer.map((key) => (
          <span key={key} className="mono">
            {formatFooter(key, row[key])}
          </span>
        ))}
      </footer>
    </aside>
  );
}

function renderField(field: FieldSpec, value: unknown): ReactNode {
  if (isEmptyValue(value)) {
    // Only constraint fields reach here; visibleFields drops empty descriptive
    // ones. "None recorded" is a statement, not a placeholder.
    return <span className="muted">{field.emptyText ?? "None recorded"}</span>;
  }
  return renderValue(value, field.kind);
}

function renderValue(value: unknown, kind: FieldSpec["kind"]): ReactNode {
  if (isEmptyValue(value)) return null;

  switch (kind) {
    case "time":
      return (
        <span title={absoluteTime(String(value))}>{relativeTime(String(value))}</span>
      );
    case "mono":
      // Deliberately not a link. An artifact URI is a repository path, and
      // making it clickable would promise navigation that cannot resolve.
      return <span className="mono">{String(value)}</span>;
    case "tags":
      return <Tags value={String(value)} />;
    case "agentLink":
      return <a href={`#/agents`} className="mono">{String(value)}</a>;
    case "taskLink":
      return <a href={`#/tasks/${String(value)}`} className="mono">{String(value)}</a>;
    case "taskLinks":
      return <TaskLinks value={value} />;
    default:
      return <span className="wrap-text">{String(value)}</span>;
  }
}

function TaskLinks({ value }: { value: unknown }) {
  const ids = Array.isArray(value)
    ? value.map(String)
    : String(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
  return (
    <>
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 ? ", " : ""}
          <a href={`#/tasks/${id}`} className="mono">
            {id}
          </a>
        </span>
      ))}
    </>
  );
}

function formatFooter(key: string, value: unknown): string {
  if (isEmptyValue(value)) return "";
  if (key.endsWith("_at")) return `${key.replace(/_at$/, "")} ${absoluteTime(String(value))}`;
  return String(value);
}
