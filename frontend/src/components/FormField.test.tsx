/**
 * The shared form field (from the structural review).
 *
 * These pin the wiring the four hand-rolled copies got inconsistently right:
 * a label that points at its control, a hint and an error that both reach it
 * through aria-describedby, and aria-invalid present only when there is an
 * error. Two of the four originals never set aria-invalid at all despite
 * validating, which is the defect this component exists to make impossible.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField.tsx";

const renderField = (over: Partial<Parameters<typeof FormField>[0]> = {}) =>
  render(
    <FormField id="target" label="This task waits on" {...over}>
      {(control) => <input {...control} defaultValue="" />}
    </FormField>,
  );

describe("FormField", () => {
  it("associates the label with the control", () => {
    renderField();
    expect(screen.getByLabelText("This task waits on")).toBeTruthy();
  });

  it("leaves a clean control undescribed and not invalid", () => {
    renderField();
    const input = screen.getByLabelText("This task waits on");
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("points the control at its hint", () => {
    renderField({ hint: "Task id, for example UI-12" });
    const input = screen.getByLabelText("This task waits on");
    const described = input.getAttribute("aria-describedby");
    expect(described).toBe("target-hint");
    expect(document.getElementById(described!)?.textContent).toBe("Task id, for example UI-12");
  });

  it("marks the control invalid and points at the error", () => {
    // The half the hand-rolled copies kept forgetting.
    renderField({ error: "A task cannot depend on itself." });
    const input = screen.getByLabelText("This task waits on");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("target-error");
  });

  it("describes by hint then error, general rule before specific failure", () => {
    renderField({ hint: "Task id", error: "Not that one" });
    const described = screen
      .getByLabelText("This task waits on")
      .getAttribute("aria-describedby");
    expect(described).toBe("target-hint target-error");
  });

  it("announces the error rather than leaving it to be discovered", () => {
    renderField({ error: "Name the task this one waits on." });
    expect(screen.getByRole("alert").textContent).toBe("Name the task this one waits on.");
  });

  it("renders no alert when there is nothing wrong", () => {
    renderField({ hint: "Task id" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps ids unique per field, so two on one form cannot collide", () => {
    render(
      <>
        <FormField id="a" label="First" error="bad">
          {(c) => <input {...c} />}
        </FormField>
        <FormField id="b" label="Second" error="also bad">
          {(c) => <input {...c} />}
        </FormField>
      </>,
    );
    expect(screen.getByLabelText("First").getAttribute("aria-describedby")).toBe("a-error");
    expect(screen.getByLabelText("Second").getAttribute("aria-describedby")).toBe("b-error");
  });

  it("wires a select the same way it wires an input", () => {
    // The render prop exists so the abstraction is not input-only.
    render(
      <FormField id="rel" label="Relationship" error="pick one">
        {(control) => (
          <select {...control}>
            <option value="blocks">blocks</option>
          </select>
        )}
      </FormField>,
    );
    expect(screen.getByLabelText("Relationship").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("FormField error attributes", () => {
  it("pairs aria-errormessage with aria-invalid, as BroadcastFields did", () => {
    render(
      <FormField id="body" label="Message" error="Say something">
        {(control) => <textarea {...control} />}
      </FormField>,
    );
    const control = screen.getByLabelText("Message");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-errormessage")).toBe("body-error");
    // And describedby too: errormessage is precise, describedby is the one
    // every screen reader actually honours.
    expect(control.getAttribute("aria-describedby")).toContain("body-error");
  });

  it("sets no error attributes when there is no error", () => {
    render(
      <FormField id="body" label="Message">
        {(control) => <textarea {...control} />}
      </FormField>,
    );
    const control = screen.getByLabelText("Message");
    expect(control.getAttribute("aria-errormessage")).toBeNull();
    expect(control.getAttribute("aria-invalid")).toBeNull();
  });
});
