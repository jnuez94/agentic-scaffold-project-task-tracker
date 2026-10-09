/**
 * After a refused submit, focus moves to the field that was refused (UI-79).
 *
 * The forms check a draft and keep one problem, naming its field. The error
 * text was announced, but focus stayed on the submit button, so a keyboard
 * operator had to find the field the message was about. A problem that names
 * no field (no actor selected — that is the header's) moves nothing.
 *
 * Keyed on the problem object, so a second refusal of the same field focuses
 * it again: every `setProblem` call makes a new one.
 */

import { useEffect } from "react";

export function useFocusProblem<F extends string>(
  problem: { field: F } | null,
  controlIds: Readonly<Partial<Record<F, string>>>,
): void {
  useEffect(() => {
    if (!problem) return;
    const id = controlIds[problem.field];
    if (id) document.getElementById(id)?.focus();
  }, [problem, controlIds]);
}
