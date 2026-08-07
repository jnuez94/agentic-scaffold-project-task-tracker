/**
 * An artifact's recorded paths (UI-57).
 *
 * Three things this fixes, all with data the console already has:
 *
 * 1. The field is not reliably one path. Rendered as a single string it is a
 *    run-on that is neither readable nor copyable for the fifth of records
 *    holding several.
 * 2. A path in plain text reads as though the console knows something about
 *    it. It does not — 4 of 15 already dangle. The caveat is stated once,
 *    because repeating it per line would make it louder than the paths.
 * 3. Opening a path in your own editor is the real workflow, and it was
 *    select-and-copy by hand. Each line gets a copy control.
 */

import { useState } from "react";
import { notVerifiedNote, pathSummary, splitPaths } from "../lib/artifactPaths.ts";

export function PathList({
  uri,
  onCopied,
}: {
  uri: unknown;
  /** Routed to the live region, so a copy is announced like any other outcome. */
  onCopied?: (message: string) => void;
}) {
  const paths = splitPaths(uri);
  const [copied, setCopied] = useState<string | null>(null);

  if (paths.length === 0) {
    return <span className="muted">None recorded</span>;
  }

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(path);
      onCopied?.(`Copied ${path}`);
    } catch {
      // Stated rather than swallowed: the operator needs to know to select it
      // by hand, which is the workflow this was replacing.
      setCopied(null);
      onCopied?.("Copying failed. Select the path and copy it manually.");
    }
  };

  return (
    <div className="path-list">
      <ul>
        {paths.map((path, index) => (
          // Index in the key because a uri may legitimately repeat a path, and
          // the record is shown as written rather than deduplicated.
          <li key={`${path}-${index}`}>
            <span className="mono path-value">{path}</span>
            <button
              type="button"
              className="path-copy"
              onClick={() => void copy(path)}
              aria-label={`Copy ${path}`}
            >
              {copied === path ? "Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted path-note">{notVerifiedNote(uri)}</p>
    </div>
  );
}

/**
 * The same field in a table cell (UI-57).
 *
 * One line, always. The paths themselves are read and copied in the inspector;
 * the column's job is only to stop implying the field holds a single path when
 * it holds three.
 */
export function PathSummary({ uri }: { uri: unknown }) {
  const { first, extra } = pathSummary(uri);
  if (!first) return <span className="muted">—</span>;
  return (
    <span className="small mono path-summary" title={String(uri)}>
      {first}
      {extra > 0 ? <span className="muted"> +{extra} more</span> : null}
    </span>
  );
}
