/**
 * The database identity in the status bar.
 *
 * Shows a shortened path by default. The full path contains the local
 * username and directory structure, and it was previously on screen
 * permanently — visible in every screenshot and screen share (design-qa.md,
 * P2). Revealing it is a deliberate act, and copying does not require
 * revealing.
 */

import { useState } from "react";

export function shortenDatabasePath(path: string): string {
  if (!path) return "";
  const marker = "/.coordination/";
  const index = path.lastIndexOf(marker);
  if (index !== -1) return `.coordination/${path.slice(index + marker.length)}`;
  const segments = path.split("/").filter(Boolean);
  return segments.length <= 2 ? path : `…/${segments.slice(-2).join("/")}`;
}

export function DatabaseIdentity({
  path,
  onCopied,
}: {
  path: string | undefined;
  onCopied?: (message: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  if (!path) return <span className="muted">resolving database…</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      onCopied?.("Full database path copied to the clipboard.");
    } catch {
      onCopied?.("Copying failed. Reveal the path and copy it manually.");
    }
  };

  return (
    <span className="db-identity">
      <span className="mono" title={revealed ? path : "Shortened; reveal to see the full path"}>
        {revealed ? path : shortenDatabasePath(path)}
      </span>
      <button
        className="link-button"
        onClick={() => setRevealed((value) => !value)}
        aria-expanded={revealed}
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
      <button className="link-button" onClick={copy}>
        Copy
      </button>
    </span>
  );
}
