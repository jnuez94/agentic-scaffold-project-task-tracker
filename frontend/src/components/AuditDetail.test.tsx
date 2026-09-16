import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditDetail } from "./AuditDetail.tsx";

describe("AuditDetail", () => {
  it("renders the cause as a link to its record and the rest as text", () => {
    render(<AuditDetail detail="in_progress -> review; revision 2 -> 3; because=review:REV-1" />);
    const link = screen.getByRole("link", { name: "review REV-1" });
    expect(link.getAttribute("href")).toBe("#/reviews/REV-1");
    expect(screen.getByText(/in_progress -> review; revision 2 -> 3/)).toBeTruthy();
  });

  it("leaves a detail without a cause exactly as written", () => {
    render(<AuditDetail detail="proposed -> accepted; because it was time" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("proposed -> accepted; because it was time")).toBeTruthy();
  });
});
