/**
 * The Markdown export.
 *
 * Rendered as preformatted text, never as parsed Markdown: the report contains
 * stored text written by other agents, and interpreting it as markup would let
 * one record's content restyle the page.
 */

import { ErrorBanner, SkeletonRows } from "../components/Feedback.tsx";
import { relativeTime } from "../lib/format.ts";
import { useApp } from "../state/AppContext.tsx";
import { useResource } from "../state/useResource.ts";

export function ExportView() {
  const { coordination, announce } = useApp();
  const report = useResource(() => coordination.exportReport(), []);

  const copy = async () => {
    if (!report.data) return;
    try {
      await navigator.clipboard.writeText(report.data);
      announce("Report copied to the clipboard.");
    } catch {
      announce("Copying failed. Select the text and copy manually.");
    }
  };

  return (
    <section className="export" aria-label="Markdown export">
      <div className="view-header">
        <h1>Export</h1>
        <p className="small muted">
          The same Markdown report `coordination export` writes. Generated{" "}
          {report.lastUpdated ? relativeTime(report.lastUpdated.toISOString()) : "—"}.
        </p>
      </div>

      <div className="queue-toolbar">
        <button onClick={report.refresh} disabled={report.loading}>
          {report.loading ? "Regenerating…" : "Regenerate"}
        </button>
        <button className="primary" onClick={copy} disabled={!report.data}>
          Copy to clipboard
        </button>
        <p className="small muted">
          Writing the report to a file is a CLI operation: `coordination export --output PATH`.
        </p>
      </div>

      {report.error ? <ErrorBanner error={report.error} onRetry={report.refresh} /> : null}
      {!report.loaded && report.loading ? <SkeletonRows rows={10} columns={1} /> : null}
      {report.data ? <pre className="report">{report.data}</pre> : null}
    </section>
  );
}
