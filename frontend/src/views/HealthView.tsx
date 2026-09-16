/**
 * Coordination health: the checks that reveal quiet decay.
 */

import { useRef, useState } from "react";
import type { Health, Session } from "../api/contract.ts";
import { blockingReason } from "../lib/escalationDraft.ts";
import { stashEscalationIntent } from "../lib/escalationIntent.ts";
import { EmptyState, ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { relativeTime } from "../lib/format.ts";
import { asSession, asTask, describe, identify } from "../lib/healthRows.ts";
import { useApp } from "../state/AppContext.tsx";
import { buildHash } from "../state/useHashRoute.ts";
import { useResource } from "../state/useResource.ts";
import { HealthInformational } from "./HealthInformational.tsx";
import { SessionRecovery } from "./SessionRecovery.tsx";

/**
 * Where a finding's record lives, so the id can be a link rather than a string
 * the operator has to copy and hunt for on another route. Every kind here has
 * a detail route since UI-69, so each finding lands in its own inspector.
 */
type FindingLink = "task" | "session" | "escalation" | null;

const SECTIONS: { key: keyof Health; title: string; hint: string; link: FindingLink }[] = [
  { key: "unowned_tasks", title: "Unowned tasks", hint: "Assign an owner or close as invalid.", link: "task" },
  { key: "stale_tasks", title: "Stale tasks", hint: "Ask the owner for status or reassign.", link: "task" },
  { key: "stale_sessions", title: "Stale sessions", hint: "Idle longer than the threshold. A session may still be in use — check when it was last seen before recovering it.", link: "session" },
  { key: "unclaimed_in_progress_tasks", title: "In progress without a claim", hint: "An invariant violation; inspect with `coordination doctor`.", link: "task" },
  { key: "invalid_active_claims", title: "Invalid active claims", hint: "The claim references an inactive session or actor.", link: "task" },
  // "or escalate" is back (UI-49). It was removed in UI-24 because the console
  // had no way to raise one and the instruction sent operators hunting for a
  // control that was not there. The capability and the copy land together, so
  // the promise is kept at the same commit it is made.
  { key: "active_blockers", title: "Blocked tasks", hint: "Open each task to see what is blocking it, then resolve the blocker or escalate.", link: "task" },
  { key: "done_without_evidence", title: "Done without evidence", hint: "Reopen or attach evidence.", link: "task" },
  { key: "open_escalations", title: "Open escalations", hint: "Route to the owner with the authority to decide.", link: "escalation" },
];

export function HealthView() {
  const { coordination, identity } = useApp();
  const health = useResource(() => coordination.health(), []);
  // Loaded so the recovery dialog can name the tasks it will block rather than
  // describing them in the abstract.
  const tasks = useResource(() => coordination.tasks({ limit: 500 }), []);
  const [recovering, setRecovering] = useState<Session | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);

  if (health.error) return <ErrorBanner error={health.error} onRetry={health.refresh} />;
  if (!health.data) return <SkeletonRows rows={6} columns={2} />;

  const data = health.data;
  const findings = SECTIONS.map((section) => ({
    ...section,
    rows: (data[section.key] as unknown[]) ?? [],
    // Sections are capped by the health limit. Rendering a capped length as an
    // exact count would understate the finding, so truncated sections are
    // marked rather than counted.
    truncated: data.truncated_sections.includes(String(section.key)),
  })).filter((section) => section.rows.length > 0);

  return (
    <section className="health" aria-label="Coordination health">
      <div className="view-header">
        <h1>Health</h1>
        <p className="small muted">
          Checked {health.lastUpdated ? relativeTime(health.lastUpdated.toISOString()) : "—"}. Defaults:
          7 day stale threshold, 60 minute session threshold.
        </p>
      </div>

      <div className={data.healthy ? "health-banner healthy" : "health-banner unhealthy"} role="status">
        <span className="health-glyph" aria-hidden="true">
          {data.healthy ? "✓" : "!"}
        </span>
        <div>
          <p className="health-title">
            {data.healthy
              ? "No findings"
              : `${findings.length} section${findings.length === 1 ? " needs" : "s need"} attention`}
          </p>
          <p className="small muted">
            {data.healthy
              ? "Every anomaly section returned zero rows."
              : "Healthy is true only when every anomaly section is empty."}
          </p>
        </div>
      </div>

      {data.truncated_sections.length > 0 ? (
        <p className="small muted">
          Truncated (more rows exist): {data.truncated_sections.join(", ")}
        </p>
      ) : null}

      {findings.length === 0 ? (
        <EmptyState title="Nothing to act on" hint="Re-run before major reviews and before release." />
      ) : (
        findings.map((section) => (
          <div className="health-section" key={String(section.key)}>
            <h2>
              {section.title}{" "}
              <span className="count" title={section.truncated ? "More rows exist than are shown" : undefined}>
                {section.rows.length}
                {section.truncated ? "+" : ""}
              </span>
            </h2>
            <p className="small muted">{section.hint}</p>
            <ul className="record-list">
              {section.rows.map((row, index) => (
                <li key={identify(row, index)}>
                  {/* Health names the exact record that needs attention and
                      used to render it as plain text, so the operator read an
                      id off the screen and went hunting for it on another
                      route. #/tasks/{id} already resolves and opens the
                      inspector; this just points at it. */}
                  {findingHref(section.link, identify(row, index)) ? (
                    <a className="mono" href={findingHref(section.link, identify(row, index))!}>
                      {identify(row, index)}
                    </a>
                  ) : (
                    <span className="mono">{identify(row, index)}</span>
                  )}
                  {describe(row) ? <span className="small"> — {describe(row)}</span> : null}
                  {/* The hint on this section tells the operator to recover the
                      session; until now the route offered no way to do it. */}
                  {/* UI-49: the same escalation form the inspector hosts, opened
                      on the task with its blocking reason already quoted into
                      the issue, because someone who has just read why a task is
                      blocked should not retype it. */}
                  {section.key === "active_blockers" && asTask(row) ? (
                    <button
                      type="button"
                      className="record-action"
                      onClick={() => {
                        const task = asTask(row)!;
                        stashEscalationIntent({ taskId: task.id, issue: blockingReason(task) });
                        globalThis.location.hash = buildHash("tasks", task.id);
                      }}
                    >
                      Escalate…
                    </button>
                  ) : null}
                  {section.key === "stale_sessions" && asSession(row) ? (
                    <button
                      type="button"
                      /* Same weight as the identical action in the record
                         inspector. A dense table row earns the quieter
                         .link-button; a findings list does not, and one action
                         wearing two faces in two panels is just noise. */
                      className="record-action"
                      onClick={(event) => {
                        launcher.current = event.currentTarget;
                        setRecovering(asSession(row));
                      }}
                    >
                      Recover…
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {/* UI-65: the sections that never make a project unhealthy, rendered
          below and quieter than the ones that do. */}
      <HealthInformational health={data} tasks={tasks.data ?? []} />

      {recovering ? (
        <>
          <div className="sheet-scrim" onClick={() => setRecovering(null)} aria-hidden="true" />
          <SessionRecovery
            session={recovering}
            tasks={(tasks.data ?? [])}
            actorId={identity.actorId}
            onClose={() => {
              setRecovering(null);
              launcher.current?.focus();
            }}
            onRecovered={() => {
              health.refresh();
              tasks.refresh();
            }}
          />
        </>
      ) : null}
    </section>
  );
}

/** The hash a finding id should point at, or null when it has nowhere to go. */
export function findingHref(link: FindingLink, id: string): string | null {
  if (!id || id.startsWith("row-")) return null;
  if (link === "task") return buildHash("tasks", id);
  if (link === "session") return buildHash("sessions", id);
  if (link === "escalation") return buildHash("escalations", id);
  return null;
}
