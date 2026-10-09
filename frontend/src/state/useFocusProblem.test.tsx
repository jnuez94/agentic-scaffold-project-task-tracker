import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFocusProblem } from "./useFocusProblem.ts";

const IDS = { title: "f-title", owner: "f-owner" } as const;

function Form({ problem }: { problem: { field: "title" | "owner" | "actor" } | null }) {
  useFocusProblem(problem, IDS);
  return (
    <form>
      <input id="f-title" />
      <input id="f-owner" />
      <button type="submit">Save</button>
    </form>
  );
}

describe("useFocusProblem", () => {
  it("focuses the refused field", () => {
    const { rerender } = render(<Form problem={null} />);
    rerender(<Form problem={{ field: "owner" }} />);
    expect(document.activeElement?.id).toBe("f-owner");
  });

  it("focuses it again on a second refusal of the same field", () => {
    const { rerender, getByRole } = render(<Form problem={{ field: "title" }} />);
    getByRole("button").focus();
    rerender(<Form problem={{ field: "title" }} />);
    expect(document.activeElement?.id).toBe("f-title");
  });

  it("moves nothing for a problem that names no field here", () => {
    const { rerender, getByRole } = render(<Form problem={null} />);
    getByRole("button").focus();
    rerender(<Form problem={{ field: "actor" }} />);
    expect(document.activeElement).toBe(getByRole("button"));
  });
});
