import { describe, expect, it } from "vitest";
import type { Agent } from "../api/contract.ts";
import { anyPicked, pickerOptions, whereClauses } from "./recordPickers.ts";

const AGENTS = [
  { id: "alice", name: "Alice", status: "active" },
  { id: "bob", name: "Bob", status: "inactive" },
] as Agent[];

describe("whereClauses", () => {
  it("turns each chosen value into one eq clause and skips the empty ones", () => {
    expect(whereClauses({ status: "accepted", owner_id: "", type: "document" })).toEqual([
      "status:eq=accepted",
      "type:eq=document",
    ]);
    expect(whereClauses({})).toEqual([]);
    expect(anyPicked({ status: "" })).toBe(false);
    expect(anyPicked({ status: "open" })).toBe(true);
  });
});

describe("pickerOptions", () => {
  it("offers an enum's values as they are", () => {
    expect(pickerOptions({ column: "status", label: "Status", kind: "enum", values: ["a", "b"] }, AGENTS)).toEqual([
      { value: "a", label: "a" },
      { value: "b", label: "b" },
    ]);
  });

  it("offers every agent, retired included, by name and id", () => {
    const options = pickerOptions({ column: "owner_id", label: "Owner", kind: "agent" }, AGENTS);
    expect(options.map((option) => option.value)).toEqual(["alice", "bob"]);
    expect(options[1]!.label).toMatch(/Bob/);
  });

  it("puts team first for a recipient, and offers nothing for free text", () => {
    expect(pickerOptions({ column: "recipient", label: "To", kind: "recipient" }, AGENTS)[0]).toEqual({
      value: "team",
      label: "team",
    });
    expect(pickerOptions({ column: "task_id", label: "Task", kind: "text" }, AGENTS)).toEqual([]);
  });
});
