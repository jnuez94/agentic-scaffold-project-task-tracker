import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResizeHandle } from "./ResizeHandle.tsx";

function setup(direction: 1 | -1, value = 300) {
  const onResize = vi.fn();
  const onReset = vi.fn();
  render(
    <ResizeHandle
      label="Resize navigation"
      value={value}
      min={160}
      max={420}
      direction={direction}
      onResize={onResize}
      onReset={onReset}
    />,
  );
  return { onResize, onReset, handle: screen.getByRole("separator") };
}

describe("ResizeHandle accessibility", () => {
  it("exposes separator semantics with current and bounding values", () => {
    const { handle } = setup(1, 300);
    expect(handle).toHaveProperty("tabIndex", 0);
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("300");
    expect(handle.getAttribute("aria-valuemin")).toBe("160");
    expect(handle.getAttribute("aria-valuemax")).toBe("420");
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    const { handle } = setup(1);
    await user.tab();
    expect(document.activeElement).toBe(handle);
  });

  it("has an accessible name", () => {
    const { handle } = setup(1);
    expect(handle.getAttribute("aria-label")).toBe("Resize navigation");
  });

  it("rounds a fractional value for aria-valuenow", () => {
    const { handle } = setup(1, 300.7);
    expect(handle.getAttribute("aria-valuenow")).toBe("301");
  });
});

describe("ResizeHandle keyboard resizing", () => {
  it("grows a left-hand pane on ArrowRight", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(onResize).toHaveBeenCalledWith(316);
  });

  it("shrinks a left-hand pane on ArrowLeft", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{ArrowLeft}");
    expect(onResize).toHaveBeenCalledWith(284);
  });

  it("inverts for a right-hand pane, so the separator still tracks the key", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(-1, 500);
    handle.focus();
    await user.keyboard("{ArrowRight}");
    // Separator moves right, so the right-hand pane gets narrower.
    expect(onResize).toHaveBeenCalledWith(484);
  });

  it("uses a coarse step with Shift", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(onResize).toHaveBeenCalledWith(364);
  });

  it("jumps to the bounds with Home and End", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{Home}");
    expect(onResize).toHaveBeenLastCalledWith(160);
    await user.keyboard("{End}");
    expect(onResize).toHaveBeenLastCalledWith(420);
  });

  it("swaps Home and End for a right-hand pane", async () => {
    const user = userEvent.setup();
    const { onResize, handle } = setup(-1, 500);
    handle.focus();
    await user.keyboard("{Home}");
    expect(onResize).toHaveBeenLastCalledWith(420);
  });

  it("resets on Enter", async () => {
    const user = userEvent.setup();
    const { onReset, onResize, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{Enter}");
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onResize).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", async () => {
    const user = userEvent.setup();
    const { onResize, onReset, handle } = setup(1, 300);
    handle.focus();
    await user.keyboard("{ArrowUp}a ");
    expect(onResize).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });
});

describe("ResizeHandle pointer resizing", () => {
  it("resets on double-click", async () => {
    const user = userEvent.setup();
    const { onReset, handle } = setup(1);
    await user.dblClick(handle);
    expect(onReset).toHaveBeenCalled();
  });
});
