import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavSidebar } from "./NavSidebar.tsx";

describe("NavSidebar badges", () => {
  it("carries a count chip on a destination that has one", () => {
    render(
      <NavSidebar active="tasks" meta={undefined} theme="flowline" onTheme={() => {}} badges={{ messages: "3" }} />,
    );
    const link = screen.getByRole("link", { name: /Messages/ });
    expect(link.textContent).toContain("3");
    expect(link.textContent).toContain("unread");
  });

  it("shows no chip for null or absent counts", () => {
    render(<NavSidebar active="tasks" meta={undefined} theme="flowline" onTheme={() => {}} badges={{ messages: null }} />);
    expect(document.querySelector(".nav-count")).toBeNull();
  });
});
