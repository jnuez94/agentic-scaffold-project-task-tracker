import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../api/contract.ts";
import { changesSince, collisionLine, describeChange, EDITING } from "./sinceLoaded.ts";

const row = (id: number, action: string, detail: string, object_type = "task"): AuditEntry => ({
  id,
  actor: "david",
  session_id: "s-1",
  action,
  object_type,
  object_id: "T-1",
  detail,
  created_at: "2026-10-21T10:00:00+00:00",
});

describe("changesSince for a task, by revision", () => {
  const history = [
    row(1, "create", ""),
    row(2, "claim", "revision 1 -> 2"),
    row(3, "status", "in_progress -> review; revision 2 -> 3"),
    row(4, "assign", "add=toby; remove=; revision 3 -> 4"),
    row(5, "update", "fields=next_steps; revision 4 -> 5"),
  ];

  it("keeps only the changes that moved the task past the loaded revision, newest first", () => {
    expect(changesSince(history, { revision: 3 }).map((entry) => entry.id)).toEqual([5, 4]);
  });

  it("is empty when nothing moved past it", () => {
    expect(changesSince(history, { revision: 5 })).toEqual([]);
  });
});

describe("changesSince for a status-guarded record", () => {
  const history = [
    row(1, "create", "draft", "artifact"),
    row(2, "status", "draft -> review", "artifact"),
    row(3, "update", "fields=uri", "artifact"),
    row(4, "status", "review -> accepted; because=review:R-1", "artifact"),
  ];

  it("starts at the first move away from the loaded status", () => {
    expect(changesSince(history, { status: "draft" }).map((entry) => entry.id)).toEqual([4, 3, 2]);
    expect(changesSince(history, { status: "review" }).map((entry) => entry.id)).toEqual([4]);
  });

  it("ignores an earlier cycle through the same status (draft -> review -> draft)", () => {
    const at = (id: number, action: string, detail: string, minute: number): AuditEntry => ({
      ...row(id, action, detail, "artifact"),
      created_at: `2026-10-21T10:0${minute}:00+00:00`,
    });
    const cycled = [
      at(1, "create", "draft", 0),
      at(2, "status", "draft -> review", 1),
      at(3, "update", "fields=uri", 2),
      at(4, "status", "review -> draft", 3),
      // Loaded here: the row's updated_at is 10:03.
      at(5, "status", "draft -> review", 5),
    ];
    const loaded = { status: "draft", updatedAt: "2026-10-21T10:03:00+00:00" };
    expect(changesSince(cycled, loaded).map((entry) => entry.id)).toEqual([5]);
    // The pre-load correction is not a collision with the operator's own edit.
    expect(collisionLine(changesSince(cycled, loaded), EDITING.correction)).toBeNull();
  });

  it("counts a correction made after the load, before the move", () => {
    const at = (id: number, action: string, detail: string, minute: number): AuditEntry => ({
      ...row(id, action, detail, "artifact"),
      created_at: `2026-10-21T10:0${minute}:00+00:00`,
    });
    const history = [
      at(1, "create", "draft", 0),
      at(2, "update", "fields=uri", 4),
      at(3, "status", "draft -> review", 5),
    ];
    const loaded = { status: "draft", updatedAt: "2026-10-21T10:00:00+00:00" };
    expect(changesSince(history, loaded).map((entry) => entry.id)).toEqual([3, 2]);
  });

  it("is empty when the history cannot place the move, as on older single-word details", () => {
    expect(changesSince([row(9, "status", "accepted", "artifact")], { status: "draft" })).toEqual([]);
  });
});

describe("describeChange", () => {
  it("says each kind of change in the operator's words", () => {
    expect(describeChange(row(1, "status", "in_progress -> review; revision 2 -> 3"))).toBe("Status: in_progress -> review");
    expect(describeChange(row(1, "status", "proposed -> superseded; because=decision:D-2; replaced"))).toBe(
      "Status: proposed -> superseded",
    );
    expect(describeChange(row(1, "resolve", "open -> resolved", "escalation"))).toBe("Status: open -> resolved");
    expect(describeChange(row(1, "assign", "add=toby; remove=david; revision 3 -> 4"))).toBe("Assignees: + toby, − david");
    expect(describeChange(row(1, "update", "fields=next_steps,blocked_claims; revision 4 -> 5"))).toBe(
      "Edited: Next steps, Does not authorize",
    );
    expect(describeChange(row(1, "update", "fields=uri,usage_boundaries", "artifact"))).toBe("Edited: Paths, Usage boundaries");
    expect(describeChange(row(1, "claim", "revision 1 -> 2"))).toBe("Claimed");
    expect(describeChange(row(1, "heartbeat", ""))).toBe("Heartbeat");
  });
});

describe("collisionLine", () => {
  const changes = [row(4, "assign", "add=toby; remove=; revision 3 -> 4")];

  it("leads with the operator's own field when it changed too", () => {
    expect(collisionLine(changes, EDITING.assignees)).toBe("You were editing Assignees — it changed too.");
  });

  it("says nothing when the changes touched something else, or nothing was being edited", () => {
    expect(collisionLine(changes, EDITING.status)).toBeNull();
    expect(collisionLine(changes, undefined)).toBeNull();
  });
});
