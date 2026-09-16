import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../api/contract.ts";
import { RecordPickers } from "./RecordPickers.tsx";

const AGENTS = [{ id: "alice", name: "Alice", status: "active" }] as Agent[];

describe("RecordPickers", () => {
  it("renders a select per structured column and reports a choice by column", async () => {
    const onChange = vi.fn();
    render(
      <RecordPickers
        pickers={[
          { column: "status", label: "Status", kind: "enum", values: ["open", "resolved"] },
          { column: "raised_by", label: "Raised by", kind: "agent" },
        ]}
        values={{}}
        agents={AGENTS}
        idPrefix="esc"
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
    expect(onChange).toHaveBeenCalledWith("status", "resolved");
    await userEvent.selectOptions(screen.getByLabelText("Raised by"), "alice");
    expect(onChange).toHaveBeenCalledWith("raised_by", "alice");
  });

  it("applies a typed value on Enter, not per keystroke", async () => {
    const onChange = vi.fn();
    render(
      <RecordPickers
        pickers={[{ column: "task_id", label: "Task", kind: "text" }]}
        values={{}}
        agents={[]}
        idPrefix="msg"
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByLabelText("Task"), "UI-7");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("task_id", "UI-7");
  });
});
