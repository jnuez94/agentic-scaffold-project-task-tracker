import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar.tsx";

const TABS = [
  { id: "details", label: "Details" },
  { id: "activity", label: "Activity", count: 3 },
] as const;

describe("TabBar", () => {
  it("marks the active tab and names each tab's panel", () => {
    render(<TabBar tabs={TABS} active="details" onChange={() => {}} label="Record sections" idPrefix="rec" />);
    const details = screen.getByRole("tab", { name: "Details" });
    expect(details.getAttribute("aria-selected")).toBe("true");
    expect(details.getAttribute("aria-controls")).toBe("rec-panel-details");
    expect(screen.getByRole("tab", { name: /Activity/ }).tabIndex).toBe(-1);
    expect(screen.getByText("3").className).toBe("tab-count");
  });

  it("moves with the arrow keys and wraps", async () => {
    const onChange = vi.fn();
    render(<TabBar tabs={TABS} active="activity" onChange={onChange} label="Record sections" idPrefix="rec" />);
    screen.getByRole("tab", { name: /Activity/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("details");
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("details");
  });
});
