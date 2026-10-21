/**
 * The Overview of a task that is not blocked (UI-25). A blocked task's
 * "Why this is blocked" is covered in BlockedReason.test.tsx (UI-83).
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
