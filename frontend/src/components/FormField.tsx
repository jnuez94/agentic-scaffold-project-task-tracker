/**
 * A labelled, described, validatable form control.
 *
 * Not to be confused with `Field` in Fields.tsx, which displays a recorded
 * value in an inspector and takes no input. The two shared a CSS class and a
 * name while being different things, which is part of why this abstraction was
 * never noticed as missing.
 *
 * It was missing. Four surfaces hand-rolled the same label/hint/error markup:
 * AssigneeFields, DependencyForm, SessionRecovery and BroadcastFields.
 *
 * A correction to what an earlier version of this comment claimed. I read the
 * uneven `aria-invalid` across those four as drift; it is not. AssigneeFields
 * reports refusals as a banner about the whole operation, SessionRecovery
 * prevents submission with a disabled button rather than refusing with a
 * message, and neither has a field-level error to mark. Omitting the attribute
 * is right in both. The case for this component is consistency and reuse, and
 * removing the chance of future drift — not a live defect.
 *
 * BroadcastFields was the most careful of the four and set the bar here: it
 * pairs `aria-invalid` with `aria-errormessage`. This emits both that and
 * `aria-describedby`, because `aria-errormessage` is the precise attribute
 * while `aria-describedby` is the one every screen reader actually honours.
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
  /** Precise, but unevenly supported — hence the describedby above as well. */
  "aria-errormessage": string | undefined;
}

export function FormField({
  id,
  label,
  className = "field",
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  /**
   * Wrapper class. Defaults to `field`; the broadcast sheet lays its controls
   * out with `control`, and preserving that is what lets it adopt this without
   * being restyled.
   */
  className?: string;
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
    <div className={className}>
      <label className={className === "field" ? "field-label" : undefined} htmlFor={id}>
        {label}
      </label>

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-errormessage": errorId,
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
