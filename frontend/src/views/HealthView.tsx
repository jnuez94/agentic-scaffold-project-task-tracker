/**
 * Coordination health: the checks that reveal quiet decay.
 */

import type { Health } from "../api/contract.ts";
import { EmptyState, ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { relativeTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

const SECTIONS: { key: keyof Health; title: string; hint: string }[] = [
  { key: "unowned_tasks", title: "Unowned tasks", hint: "Assign an owner or close as invalid." },
  { key: "stale_tasks", title: "Stale tasks", hint: "Ask the owner for status or reassign." },
  { key: "stale_sessions", title: "Stale sessions", hint: "Recover the session to release its claims." },
  { key: "unclaimed_in_progress_tasks", title: "In progress without a claim", hint: "An invariant violation; inspect with `coordination doctor`." },
  { key: "invalid_active_claims", title: "Invalid active claims", hint: "The claim references an inactive session or actor." },
  { key: "active_blockers", title: "Blocked tasks", hint: "Resolve the blocker or escalate." },
  { key: "done_without_evidence", title: "Done without evidence", hint: "Reopen or attach evidence." },
  { key: "open_escalations", title: "Open escalations", hint: "Route to the owner with the authority to decide." },
];

export function HealthView() {
  const { coordination } = useApp();
  const health = useResource(() => coordination.health(), []);

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
              : `${findings.length} section${findings.length === 1 ? "" : "s"} need attention`}
          </p>
          <p className="small muted">
            {data.healthy
              ? "Every health section returned zero rows."
              : "Healthy is true only when every section is empty."}
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
                  <span className="mono">{identify(row, index)}</span>
                  {describe(row) ? <span className="small"> — {describe(row)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function identify(row: unknown, index: number): string {
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    for (const key of ["id", "task_id", "session_id"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return `row-${index}`;
}

function describe(row: unknown): string {
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    if (typeof record["title"] === "string") return record["title"];
    if (typeof record["issue"] === "string") return record["issue"];
    if (typeof record["harness"] === "string") return `harness ${record["harness"]}`;
  }
  return "";
}
