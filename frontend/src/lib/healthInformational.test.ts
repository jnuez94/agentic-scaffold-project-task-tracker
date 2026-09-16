import { describe, expect, it } from "vitest";
import type { Task, TaskListRow } from "../api/contract.ts";
import type { Doctor } from "../api/contract.ts";
import {
  doctorSection,
  implementerOf,
  informationalSections,
  longestWaitingFirst,
  outOfBandHref,
} from "./healthInformational.ts";

const task = (id: string, updated_at: string): Task => ({
  id,
  title: `Task ${id}`,
  description: "",
  status: "review",
  priority: 2,
  tags: "",
  acceptance_criteria: "",
  next_steps: "",
  blocked_claims: "",
  notes: "",
  revision: 1,
  created_by: "alice",
  created_at: "2026-09-01T00:00:00+00:00",
  updated_at,
});

const NEWER = task("T-2", "2026-09-14T00:00:00+00:00");
const OLDER = task("T-1", "2026-09-10T00:00:00+00:00");

describe("informationalSections", () => {
  it("omits empty sections rather than showing zero", () => {
    const sections = informationalSections({
      informational: { tasks_awaiting_review: [], something_else: [] },
      truncated_sections: [],
    });
    expect(sections).toEqual([]);
  });

  it("titles the known section and humanises unknown ones", () => {
    const sections = informationalSections({
      informational: { tasks_awaiting_review: [NEWER], recently_released: [{ id: "T-9" }] },
      truncated_sections: ["recently_released"],
    });
    expect(sections.map((section) => section.title)).toEqual(["Awaiting review", "Recently released"]);
    expect(sections[1]!.truncated).toBe(true);
    expect(sections[0]!.truncated).toBe(false);
  });

  it("orders awaiting-review tasks longest since their last update first", () => {
    const [section] = informationalSections({
      informational: { tasks_awaiting_review: [NEWER, OLDER] },
      truncated_sections: [],
    });
    expect((section!.rows as Task[]).map((row) => row.id)).toEqual(["T-1", "T-2"]);
  });

  it("tolerates a payload without the group", () => {
    expect(
      informationalSections({ informational: undefined as never, truncated_sections: [] }),
    ).toEqual([]);
  });
});

describe("longestWaitingFirst", () => {
  it("breaks ties on id so the order is stable", () => {
    const same = task("T-3", OLDER.updated_at);
    expect(longestWaitingFirst([same, OLDER]).map((row) => row.id)).toEqual(["T-1", "T-3"]);
  });
});

describe("implementerOf", () => {
  const row = (overrides: Partial<TaskListRow>): TaskListRow => ({
    ...OLDER,
    claimed_by: null,
    claim_session_id: null,
    claimed_at: null,
    assignees: [],
    evidence_count: 0,
    ...overrides,
  });

  it("names the claim holder before the assignees", () => {
    expect(implementerOf("T-1", [row({ claimed_by: "alice", assignees: ["bob"] })])).toBe("alice");
  });

  it("falls back to the assignees, joined", () => {
    expect(implementerOf("T-1", [row({ assignees: ["bob", "carol"] })])).toBe("bob, carol");
  });

  it("has no name for an unassigned task or one outside the loaded window", () => {
    expect(implementerOf("T-1", [row({})])).toBeNull();
    expect(implementerOf("T-404", [row({})])).toBeNull();
  });
});

describe("doctorSection", () => {
  const doctor = (overrides: Partial<Doctor>): Doctor => ({
    healthy: true,
    integrity_check: "ok",
    record_consistency: "ok",
    out_of_band_edits: [],
    out_of_band_edit_count: 0,
    out_of_band_edits_truncated: false,
    ...overrides,
  });

  it("is absent when doctor found nothing, or was not read", () => {
    expect(doctorSection(undefined)).toBeNull();
    expect(doctorSection(doctor({}))).toBeNull();
  });

  it("lists the rows written around the runtime, marking the cap", () => {
    const edit = { table: "tasks", id: "T-1", updated_at: "2026-09-16T00:00:00+00:00", last_audit_at: null };
    const section = doctorSection(
      doctor({ record_consistency: "findings", out_of_band_edits: [edit], out_of_band_edit_count: 1, out_of_band_edits_truncated: true }),
    );
    expect(section?.title).toBe("Records written outside the runtime");
    expect(section?.rows).toEqual([edit]);
    expect(section?.truncated).toBe(true);
  });
});

describe("outOfBandHref", () => {
  it("opens the record where a route exists and nothing where none does", () => {
    expect(outOfBandHref({ table: "tasks", id: "T-1" })).toBe("#/tasks/T-1");
    expect(outOfBandHref({ table: "decisions", id: "DEC-1" })).toBe("#/decisions/DEC-1");
    expect(outOfBandHref({ table: "task_evidence", id: "7" })).toBeNull();
  });
});
