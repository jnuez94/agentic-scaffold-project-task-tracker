/**
 * The console's icon family.
 *
 * Inline SVG rather than an icon font or Unicode glyphs. Glyphs like ☰ and ⚖
 * render with different weights and metrics per platform and several read as
 * placeholder content (design-qa.md, P2). Inline SVG also needs no font file,
 * so nothing has to be fetched and the strict CSP is unaffected.
 *
 * One geometry for all of them: a 24-unit box, 1.6 stroke, round caps and
 * joins, `currentColor`. Icons are decorative — every one is hidden from
 * assistive technology, and the link text beside it carries the name.
 */

import type { ReactElement } from "react";

export type IconName =
  | "brand"
  | "tasks"
  | "reviews"
  | "messages"
  | "agents"
  | "sessions"
  | "decisions"
  | "artifacts"
  | "escalations"
  | "health"
  | "audit"
  | "export"
  | "search"
  | "close"
  | "back";

const PATHS: Record<IconName, ReactElement> = {
  brand: (
    <>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  reviews: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" />,
  messages: <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-5.4A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7Z" />,
  agents: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 5M18.5 19.5a5.5 5.5 0 0 0-2.2-4.4" />
    </>
  ),
  sessions: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.8" />
      <path d="M8 20h8M12 16.5V20" />
    </>
  ),
  decisions: (
    <>
      <path d="M12 4v16M5 8h14" />
      <path d="M5 8 2.5 14h5L5 8ZM19 8l-2.5 6h5L19 8Z" />
    </>
  ),
  artifacts: (
    <>
      <path d="M13 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z" />
      <path d="M13 3v5h5" />
    </>
  ),
  escalations: (
    <>
      <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  health: <path d="M3 12h4l2.5-6 5 12L17 12h4" />,
  audit: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v11" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M4.5 17.5v2A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="M20 12H4m0 0 6-6m-6 6 6 6" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
