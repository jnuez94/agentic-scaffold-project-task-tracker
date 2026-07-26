/**
 * Hash routing.
 *
 * The Python server serves one document and does not rewrite unknown paths, so
 * hash routing keeps deep links working without a server-side change or a
 * router dependency.
 */

import { useCallback, useEffect, useState } from "react";

export const ROUTES = [
  "tasks",
  "reviews",
  "messages",
  "agents",
  "sessions",
  "decisions",
  "artifacts",
  "escalations",
  "health",
  "audit",
  "export",
] as const;

export type RouteName = (typeof ROUTES)[number];
export const DEFAULT_ROUTE: RouteName = "tasks";

export interface Route {
  name: RouteName;
  /** Optional second segment, e.g. the selected task in `#/tasks/UI-1`. */
  detail: string | null;
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, "");
  const [head = "", tail = ""] = cleaned.split("/", 2);
  const name = (ROUTES as readonly string[]).includes(head)
    ? (head as RouteName)
    : DEFAULT_ROUTE;
  return { name, detail: tail ? decodeURIComponent(tail) : null };
}

export function buildHash(name: RouteName, detail?: string | null): string {
  return detail ? `#/${name}/${encodeURIComponent(detail)}` : `#/${name}`;
}

export function useHashRoute(): {
  route: Route;
  navigate: (name: RouteName, detail?: string | null) => void;
} {
  const [route, setRoute] = useState<Route>(() => parseHash(globalThis.location?.hash ?? ""));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(globalThis.location.hash));
    globalThis.addEventListener("hashchange", onChange);
    return () => globalThis.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((name: RouteName, detail?: string | null) => {
    const next = buildHash(name, detail);
    if (globalThis.location.hash === next) {
      setRoute(parseHash(next));
      return;
    }
    globalThis.location.hash = next;
  }, []);

  return { route, navigate };
}
