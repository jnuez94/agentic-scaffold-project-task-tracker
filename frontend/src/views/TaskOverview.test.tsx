/**
 * Promoting the blocking reason (UI-25).
 *
 * "Blocked claims" and "Notes" sat sixth and seventh in a scroll region showing
 * a fraction of its content, so the operator saw a Blocked chip and had to go
 * looking for the sentence explaining it. The answer now leads.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskDetail } from "../api/contract.ts";
import { Overview } from "./TaskOverview.tsx";

function detail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "UX-12",
    title: "Release stabilization QA gate",
    status: "todo",
    priority: 1,
    description: "A description.",
    acceptance_criteria: "Some criteria.",
    next_steps: "",
    blocked_claims: "",
    notes: "",
    tags: "release",
    assignees: ["david"],
    claimed_by: null,
    claim_session_id: null,
    created_at: "2026-07-26T10:00:00+00:00",
    created_by: "michael-ux",
    updated_at: "2026-07-26T10:00:00+00:00",
    revision: 3,
    ...overrides,
  } as TaskDetail;
}

const firstFieldLabel = () =>
  document.querySelector(".blocked-reason .field-label, .field-label")?.textContent;

describe("Overview — blocked tasks", () => {
  it("leads with the blocking reason", () => {
    render(<Overview detail={detail({ status: "blocked", blocked_claims: "Waiting on SEC-1." })} />);
    expect(firstFieldLabel()).toBe("Why this is blocked");
    expect(screen.getByRole("note").textContent).toContain("Waiting on SEC-1.");
  });

  it("keeps the full field set below, so nothing is moved out of its place", () => {
    render(<Overview detail={detail({ status: "blocked", blocked_claims: "Waiting on SEC-1." })} />);
    // Promotion is an answer offered early, not a field relocated.
    expect(screen.getByText("Blocked claims")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Acceptance criteria")).toBeTruthy();
  });

  it("falls back to notes when there are no blocked claims", () => {
    render(<Overview detail={detail({ status: "blocked", notes: "Owner is away." })} />);
    expect(screen.getByRole("note").textContent).toContain("Owner is away.");
  });

  it("says so when a task is blocked with no recorded reason", () => {
    // Silence here would read as "no reason needed" rather than "none given".
    render(<Overview detail={detail({ status: "blocked" })} />);
    expect(screen.getByRole("note").textContent).toMatch(/No blocking reason was recorded/i);
  });

  it("prefers blocked claims over notes when both exist", () => {
    render(
      <Overview
        detail={detail({ status: "blocked", blocked_claims: "The claim.", notes: "The note." })}
      />,
    );
    expect(screen.getByRole("note").textContent).toContain("The claim.");
  });
});

describe("Overview — tasks that are not blocked", () => {
  it("shows no blocking callout", () => {
    render(<Overview detail={detail({ status: "in_progress", notes: "Progress note." })} />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(firstFieldLabel()).toBe("Description");
  });

  it("does not promote notes on a done task", () => {
    render(<Overview detail={detail({ status: "done", notes: "Completed." })} />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
