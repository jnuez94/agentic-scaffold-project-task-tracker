/**
 * The attention strip (UI-42).
 *
 * Several of these assert what the strip must *not* grow into. UX-SCOPE-2
 * rejected an Attention workspace, and the way that decision gets reversed is
 * incrementally — a heading, then a tile, then a route — so the constraint is
 * pinned here rather than left to review.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttentionBar } from "./AttentionBar.tsx";
import type { AttentionGroup } from "../lib/attentionSummary.ts";

const groups: AttentionGroup[] = [
  { reason: "blocked", label: "Blocked", count: 1 },
  { reason: "unowned", label: "Nobody owns this", count: 1 },
  { reason: "awaiting-review", label: "Waiting on a review decision", count: 10 },
];

const renderBar = (over: Partial<Parameters<typeof AttentionBar>[0]> = {}) => {
  const onSelect = vi.fn();
  render(
    <AttentionBar
      groups={groups}
      total={12}
      active={null}
      onSelect={onSelect}
      {...over}
    />,
  );
  return { onSelect };
};

describe("AttentionBar", () => {
  it("leads with the total, which is the question being answered", () => {
    renderBar();
    expect(screen.getByText(/12/)).toBeTruthy();
    expect(screen.getByText(/tasks need someone/)).toBeTruthy();
  });

  it("reads naturally for a single task", () => {
    renderBar({ groups: [groups[0]!], total: 1 });
    expect(screen.getByText(/task needs someone/)).toBeTruthy();
  });

  it("offers one control per reason", () => {
    renderBar();
    expect(screen.getByRole("button", { name: /Blocked/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Unowned/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /In review/ })).toBeTruthy();
  });

  it("selects a reason when its control is pressed", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBar();
    await user.click(screen.getByRole("button", { name: /Blocked/ }));
    expect(onSelect).toHaveBeenCalledWith("blocked");
  });

  it("deselects when the active reason is pressed again", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBar({ active: "blocked" });
    await user.click(screen.getByRole("button", { name: /Blocked/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("marks the active reason with aria-pressed, not colour alone", () => {
    renderBar({ active: "blocked" });
    expect(screen.getByRole("button", { name: /Blocked/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /Unowned/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("offers a way back only while a reason is active", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderBar({ active: "blocked" });
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("hides the way back when nothing is narrowing the list", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("states an all-clear rather than rendering nothing", () => {
    // Blank space reads as "not loaded" just as readily as "nothing to do".
    renderBar({ groups: [], total: 0 });
    expect(screen.getByRole("status").textContent).toContain("Nothing is waiting on anyone");
  });

  it("shows no reason controls when the board is clear", () => {
    renderBar({ groups: [], total: 0 });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("names the scope when the counts cover a narrower set", () => {
    renderBar({ scopeHint: "Counted across the loaded rows." });
    expect(screen.getByText("Counted across the loaded rows.")).toBeTruthy();
  });

  it("stays a strip: no heading, and no landmark of its own", () => {
    // The guard against this becoming the workspace UX-SCOPE-2 rejected.
    renderBar();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
