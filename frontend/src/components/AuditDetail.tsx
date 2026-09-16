/**
 * An audit row's detail, with its cause as a link (UI-72).
 *
 * `because=TYPE:ID` is a suffix on detail with no column of its own, so it
 * is parsed here and nowhere else; everything before it renders as text, and
 * a detail without one renders unchanged.
 */

import { becauseHref, describeCause, parseBecause } from "../lib/because.ts";

export function AuditDetail({ detail, className }: { detail: string; className?: string }) {
  const { text, because } = parseBecause(detail);
  if (!because) return <span className={className}>{detail}</span>;
  return (
    <span className={className}>
      {text}
      {text ? " · " : ""}
      because of{" "}
      <a className="mono" href={becauseHref(because)}>
        {describeCause(because)}
      </a>
    </span>
  );
}
