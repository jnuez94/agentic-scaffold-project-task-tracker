/**
 * A labelled, described, validatable form control.
 *
 * Not to be confused with `Field` in Fields.tsx, which displays a recorded
 * value in an inspector and takes no input. The two shared a CSS class and a
 * name while being different things, which is part of why this abstraction was
 * never noticed as missing.
 *
 * It was missing. Four surfaces hand-rolled the same label/hint/error markup —
 * AssigneeFields, DependencyForm, SessionRecovery and BroadcastFields — and
 * the duplication did not stay identical: `aria-invalid` was wired on two of
 * them and absent on the other two, both of which validate. Assistive
 * technology was told a control was invalid on some forms and not others, for
 * the same class of refusal.
 *
 * The control is a render prop rather than a child node because the wiring has
 * to reach the element itself: an id the label points at, `aria-describedby`
 * for the hint and the error, and `aria-invalid` when there is one. Passing a
 * plain child would leave the caller to remember all three, which is exactly
 * what went wrong before.
 */

import type { ReactNode } from "react";

export interface ControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  /** Standing guidance, shown whether or not the field is in error. */
  hint?: ReactNode;
  /** A refusal to fix. Announced, and marks the control invalid. */
  error?: string;
  children: (control: ControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // Both, in that order: the hint explains the field, the error explains this
  // attempt, and a reader wants the general rule before the specific failure.
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {hint ? (
        <span id={hintId} className="small muted">
          {hint}
        </span>
      ) : null}

      {/* role="alert" so a refusal is announced when it appears, rather than
          only being found by a reader who happens to navigate back to it. */}
      {error ? (
        <p id={errorId} className="small field-problem" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
