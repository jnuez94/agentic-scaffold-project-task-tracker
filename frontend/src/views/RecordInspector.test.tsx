/**
 * Entity record inspectors (UI-29).
 *
 * Section 8 clause 10: a fully populated record, a record with empty
 * constraint fields, cross-link resolution, and focus return on close.
 *
 * The recurring point across these: the inspector exists because fields
 * stating what a record does *not* authorise were invisible in the tables, so
 * most of what is asserted here is that those fields survive every path.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { INSPECTOR_CONFIGS } from "./inspectorConfigs.tsx";
import { RecordInspector } from "./RecordInspector.tsx";

const DECISION = {
  id: "SEC-OWNER-1",
  title: "Complete SEC-1 sole ownership",
  status: "accepted",
  owner_id: "michael-ux",
  updated_at: "2026-07-27T10:00:00+00:00",
  created_at: "2026-07-26T10:00:00+00:00",
  blocked_claims: "Ownership only. Not a security review or a release approval.",
  decision: "Toby owns SEC-1 alone.",
  context: "codex-security was deactivated.",
  options_considered: "Reassign, or split ownership.",
  implications: "SEC-1 has one accountable owner.",
  evidence: "ESC-SEC1-OWNER-1",
  review_required: "no",
};

function show(
  route: "decisions" | "reviews" | "escalations" | "artifacts",
  row: Record<string, unknown>,
) {
  const onClose = vi.fn();
  render(
    <RecordInspector config={INSPECTOR_CONFIGS[route]!} row={row} onClose={onClose} />,
  );
  return { onClose };
}

describe("RecordInspector — a fully populated record", () => {
  it("renders every declared field", () => {
    show("decisions", DECISION);
    for (const label of [
      "What this does not authorise",
      "Decision",
      "Context",
      "Options considered",
      "Implications",
      "Evidence",
      "Review required",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("puts the constraint field above the descriptive content", () => {
    // UI-25's lesson: the field stating a boundary is the reason the record is
    // opened, and it was sixth in reading order before.
    show("decisions", DECISION);
    const labels = [...document.querySelectorAll(".field-label")].map((n) => n.textContent);
    expect(labels.indexOf("What this does not authorise")).toBeLessThan(
      labels.indexOf("Decision"),
    );
  });

  it("shows the entity kind and id in the header", () => {
    // The id also appears in the diagnostic footer, per spec section 5, so
    // this scopes to the header rather than matching both.
    show("decisions", DECISION);
    expect(document.querySelector(".inspector-kind")?.textContent).toBe("decision");
    expect(document.querySelector(".inspector-id")?.textContent).toBe("SEC-OWNER-1");
  });

  it("issues no request", () => {
    // These entities have no `show` command; fetching would promise detail the
    // CLI cannot supply.
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    show("decisions", DECISION);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("RecordInspector — empty constraint fields", () => {
  it("renders None recorded rather than dropping the field", () => {
    show("decisions", { ...DECISION, blocked_claims: "" });
    expect(screen.getByText("What this does not authorise")).toBeTruthy();
    expect(screen.getByText("None recorded")).toBeTruthy();
  });

  it("uses the entity's own wording where absence means something specific", () => {
    // An unresolved escalation is not an unrecorded one.
    show("escalations", {
      id: "ESC-1",
      status: "open",
      owner_id: "david",
      raised_by: "michael-ux",
      issue: "Ownership unclear",
      resolution: "",
    });
    expect(screen.getByText("Not yet resolved")).toBeTruthy();
  });

  it("drops empty descriptive fields instead of printing blank labels", () => {
    show("decisions", { ...DECISION, context: "", implications: "" });
    expect(screen.queryByText("Context")).toBeNull();
    expect(screen.queryByText("Implications")).toBeNull();
  });
});

describe("RecordInspector — cross-links", () => {
  it("links related task ids to their task route", () => {
    show("escalations", {
      id: "ESC-2",
      status: "open",
      issue: "x",
      related_tasks: ["UI-29", "UI-30"],
    });
    expect(screen.getByRole("link", { name: "UI-29" }).getAttribute("href")).toBe("#/tasks/UI-29");
    expect(screen.getByRole("link", { name: "UI-30" }).getAttribute("href")).toBe("#/tasks/UI-30");
  });

  it("accepts a comma-separated list as well as an array", () => {
    show("escalations", { id: "ESC-3", status: "open", issue: "x", related_tasks: "UI-1, UI-2" });
    expect(screen.getByRole("link", { name: "UI-1" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "UI-2" })).toBeTruthy();
  });

  it("does not link an artifact URI", () => {
    // A repository path is not a resolvable URL; a link would promise
    // navigation that cannot happen.
    show("artifacts", {
      id: "ART-1",
      type: "spec",
      status: "accepted",
      owner_id: "michael-ux",
      uri: "docs/ux-entity-inspectors-spec.md",
      usage_boundaries: "internal",
    });
    const uri = screen.getByText("docs/ux-entity-inspectors-spec.md");
    expect(uri.closest("a")).toBeNull();
  });
});

describe("RecordInspector — focus", () => {
  it("moves focus to the record heading on open", () => {
    show("decisions", DECISION);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: DECISION.title }),
    );
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = show("decisions", DECISION);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes from the close control", async () => {
    const user = userEvent.setup();
    const { onClose } = show("decisions", DECISION);
    await user.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("RecordInspector — read-only", () => {
  it("offers no control implying an edit or delete", () => {
    show("decisions", DECISION);
    const labels = screen
      .getAllByRole("button")
      .map((b) => (b.textContent || b.getAttribute("aria-label") || "").toLowerCase());
    for (const label of labels) {
      expect(label).not.toMatch(/edit|delete|remove|save/);
    }
  });
});
