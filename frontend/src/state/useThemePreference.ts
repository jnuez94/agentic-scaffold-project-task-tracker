/**
 * The theme, read once from storage and reflected onto the document.
 *
 * A local display preference: it never reaches the API, is never attributed to
 * an actor, and is never written to the coordination database.
 *
 * Lifted out of App because the three pieces — the store, the state, and the
 * effect that applies and persists — are one concern, and only the resulting
 * pair is App's business. App had them inline alongside routing, layout and
 * bootstrap, where they read as three more lines of shell setup rather than as
 * a thing with its own rules.
 */

import { useEffect, useRef, useState } from "react";
import {
  applyTheme,
  browserThemePreferenceStore,
  type Theme,
  type ThemePreferenceStore,
} from "./themePreference.ts";

export function useThemePreference(
  store?: ThemePreferenceStore,
  root: HTMLElement = document.documentElement,
): [Theme, (theme: Theme) => void] {
  // A ref, not useMemo: useMemo is documented as a hint React may discard, and
  // a discarded store would re-read from storage mid-session.
  const held = useRef(store ?? browserThemePreferenceStore());
  const [theme, setTheme] = useState<Theme>(() => held.current.load());

  useEffect(() => {
    applyTheme(theme, root);
    held.current.save(theme);
  }, [theme, root]);

  return [theme, setTheme];
}
