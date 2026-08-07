/**
 * Artifact paths (UI-57).
 *
 * The splitting rules are covered in lib/artifactPaths.test.ts. These assert
 * the three user-visible claims: the list is a list, the caveat is present and
 * stated once, and copying reaches the clipboard with feedback.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PathList } from "./PathList.tsx";

// Installed AFTER userEvent.setup(), which stubs navigator.clipboard itself —
// setting it up first means user-event silently overwrites the spy.
function withClipboard(writeText = vi.fn(async () => {})) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe("PathList", () => {
  it("renders each recorded path as its own line", () => {
    render(<PathList uri="docs/a.md,docs/b.md,docs/c.md" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders a single path without inventing a list of one that reads oddly", () => {
    render(<PathList uri="docs/a.md" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("docs/a.md")).toBeTruthy();
  });

  it("states that paths are recorded, not verified", () => {
    // 4 of 15 URIs on the real board already dangle. The console must not
    // imply it knows which.
    render(<PathList uri="docs/a.md" />);
    expect(screen.getByText(/does not check whether it exists/)).toBeTruthy();
  });

  it("states the caveat once, not once per path", () => {
    render(<PathList uri="docs/a.md,docs/b.md,docs/c.md" />);
    expect(screen.getAllByText(/does not check/)).toHaveLength(1);
  });

  it("agrees in number when the field holds several", () => {
    render(<PathList uri="a.md,b.md" />);
    expect(screen.getByText(/whether they exist/)).toBeTruthy();
  });

  it("says nothing was recorded rather than rendering an empty list", () => {
    render(<PathList uri="" />);
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByText("None recorded")).toBeTruthy();
  });

  it("gives every path its own copy control, labelled with the path", () => {
    render(<PathList uri="docs/a.md,docs/b.md" />);
    expect(screen.getByRole("button", { name: "Copy docs/a.md" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy docs/b.md" })).toBeTruthy();
  });

  it("copies the path it was asked for, not the whole field", async () => {
    // The defect being fixed is select-and-copy of a run-on string.
    const user = userEvent.setup();
    const writeText = withClipboard();
    render(<PathList uri="docs/a.md,docs/b.md" />);
    await user.click(screen.getByRole("button", { name: "Copy docs/b.md" }));
    expect(writeText).toHaveBeenCalledWith("docs/b.md");
  });

  it("announces the copy so it is not a silent success", async () => {
    const onCopied = vi.fn();
    const user = userEvent.setup();
    withClipboard();
    render(<PathList uri="docs/a.md" onCopied={onCopied} />);
    await user.click(screen.getByRole("button", { name: "Copy docs/a.md" }));
    expect(onCopied).toHaveBeenCalledWith("Copied docs/a.md");
  });

  it("says so when copying fails, since the fallback is manual selection", async () => {
    const onCopied = vi.fn();
    const user = userEvent.setup();
    withClipboard(vi.fn(async () => Promise.reject(new Error("denied"))));
    render(<PathList uri="docs/a.md" onCopied={onCopied} />);
    await user.click(screen.getByRole("button", { name: "Copy docs/a.md" }));
    expect(onCopied).toHaveBeenCalledWith(
      "Copying failed. Select the path and copy it manually.",
    );
  });

  it("keeps a duplicated path rather than collapsing the record", () => {
    render(<PathList uri="a.md,b.md,a.md" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
