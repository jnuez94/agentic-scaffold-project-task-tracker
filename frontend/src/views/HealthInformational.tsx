/**
 * The quiet half of Health (UI-65).
 *
 * Informational sections describe normal workflow, not decay: a full review
 * queue is a project working, not a project failing. So this group has no
 * warning glyph, no amber, and no "needs attention" framing — the attention
 * treatment is reserved for the anomaly sections above it — and it states its
 * own rule so an operator does not have to infer why it is styled differently.
 */

import type { Doctor, Health, OutOfBandEdit, Task, TaskListRow } from "../api/contract.ts";
import { absoluteTime, relativeTime } from "../lib/format.ts";
import {
  doctorSection,
  implementerOf,
  informationalSections,
  OUT_OF_BAND_KEY,
  OUT_OF_BAND_RULE,
  outOfBandHref,
} from "../lib/healthInformational.ts";
import { describe, identify } from "../lib/healthRows.ts";
import { buildHash } from "../state/useHashRoute.ts";

export function HealthInformational({
  health,
  tasks,
  doctor,
}: {
  health: Health;
  tasks: TaskListRow[];
  /** `doctor`'s record-consistency findings join the group as a second section. */
  doctor?: Doctor;
}) {
  const fromDoctor = doctorSection(doctor);
  const sections = [...informationalSections(health), ...(fromDoctor ? [fromDoctor] : [])];
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
          {section.key === OUT_OF_BAND_KEY ? <p className="small muted">{OUT_OF_BAND_RULE}</p> : null}
          <ul className="record-list">
            {section.rows.map((row, index) => (
              <li
                key={
                  section.key === OUT_OF_BAND_KEY
                    ? `${(row as OutOfBandEdit).table}/${(row as OutOfBandEdit).id}`
                    : identify(row, index)
                }
              >
                {section.key === "tasks_awaiting_review" ? (
                  <AwaitingReview task={row as Task} tasks={tasks} />
                ) : section.key === OUT_OF_BAND_KEY ? (
                  <OutOfBandRow edit={row as OutOfBandEdit} />
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

function OutOfBandRow({ edit }: { edit: OutOfBandEdit }) {
  const href = outOfBandHref(edit);
  return (
    <>
      {href ? (
        <a className="mono" href={href}>
          {edit.id}
        </a>
      ) : (
        <span className="mono">{edit.id}</span>
      )}
      <span className="small muted">
        {" · "}
        {edit.table}
        {" · changed "}
        <span title={absoluteTime(edit.updated_at)}>{relativeTime(edit.updated_at)}</span>
        {" · last audited "}
        {edit.last_audit_at ? (
          <span title={absoluteTime(edit.last_audit_at)}>{relativeTime(edit.last_audit_at)}</span>
        ) : (
          "never"
        )}
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
