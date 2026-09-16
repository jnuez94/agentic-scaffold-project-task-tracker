/**
 * The quiet half of Health (UI-65).
 *
 * Informational sections describe normal workflow, not decay: a full review
 * queue is a project working, not a project failing. So this group has no
 * warning glyph, no amber, and no "needs attention" framing — the attention
 * treatment is reserved for the anomaly sections above it — and it states its
 * own rule so an operator does not have to infer why it is styled differently.
 */

import type { Health, Task, TaskListRow } from "../api/contract.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import { implementerOf, informationalSections } from "../lib/healthInformational.ts";
import { describe, identify } from "../lib/healthRows.ts";
import { buildHash } from "../state/useHashRoute.ts";

export function HealthInformational({ health, tasks }: { health: Health; tasks: TaskListRow[] }) {
  const sections = informationalSections(health);
  if (sections.length === 0) return null;

  return (
    <section className="health-informational" aria-labelledby="health-informational-heading">
      <h2 id="health-informational-heading">Informational</h2>
      <p className="small muted">These do not affect the healthy flag.</p>

      {sections.map((section) => (
        <div className="health-section informational" key={section.key}>
          <h3>
            {section.title}{" "}
            <span
              className="count"
              title={section.truncated ? "More rows exist than are shown" : undefined}
            >
              {section.rows.length}
              {section.truncated ? "+" : ""}
            </span>
          </h3>
          <ul className="record-list">
            {section.rows.map((row, index) => (
              <li key={identify(row, index)}>
                {section.key === "tasks_awaiting_review" ? (
                  <AwaitingReview task={row as Task} tasks={tasks} />
                ) : (
                  <GenericRow row={row} index={index} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function AwaitingReview({ task, tasks }: { task: Task; tasks: TaskListRow[] }) {
  const implementer = implementerOf(task.id, tasks);
  return (
    <>
      <a className="mono" href={buildHash("tasks", task.id)}>
        {task.id}
      </a>
      <span className="small"> — {task.title}</span>
      <span className="small muted">
        {" · "}
        {implementer ?? "unassigned"}
        {" · updated "}
        <span title={absoluteTime(task.updated_at)}>{relativeTime(task.updated_at)}</span>
      </span>
    </>
  );
}

/** A section this console does not know: id and description, nothing assumed. */
function GenericRow({ row, index }: { row: unknown; index: number }) {
  const label = describe(row);
  return (
    <>
      <span className="mono">{identify(row, index)}</span>
      {label ? <span className="small"> — {label}</span> : null}
    </>
  );
}
