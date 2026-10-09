import { describe, expect, it } from "vitest";
import type { Artifact } from "../api/contract.ts";
import {
  buildCorrectionRequest,
  buildRegistrationRequest,
  buildStatusRequest,
  correctionAnnouncement,
  correctionBlockedReason,
  correctionChanges,
  correctionDraftFrom,
  emptyRegistration,
  joinPaths,
  registrationBlockedReason,
  statusBlockedReason,
} from "./artifactActions.ts";

const ARTIFACT = {
  id: "ART-1",
  uri: "docs/plan.md, docs/appendix.md",
  owner_id: "alice",
  type: "document",
  status: "draft",
  usage_boundaries: "Draft only.",
} as Artifact;

describe("paths", () => {
  it("round-trips one path per line to the CLI's comma-separated field", () => {
    const draft = correctionDraftFrom(ARTIFACT);
    expect(draft.paths).toBe("docs/plan.md\ndocs/appendix.md");
    expect(joinPaths(" docs/a.md \n\n docs/b.md ")).toBe("docs/a.md, docs/b.md");
  });
});

describe("correction", () => {
  it("sends only what changed, with the loaded status as the guard", () => {
    const draft = { ...correctionDraftFrom(ARTIFACT), type: "spec" };
    expect(correctionChanges(ARTIFACT, draft)).toEqual({ type: "spec" });
    expect(buildCorrectionRequest(ARTIFACT, draft, "david")).toEqual({ actor: "david", if_status: "draft", type: "spec" });
  });

  it("treats reordered whitespace in paths as no change", () => {
    const draft = { ...correctionDraftFrom(ARTIFACT), paths: " docs/plan.md\n docs/appendix.md \n" };
    expect(correctionChanges(ARTIFACT, draft)).toEqual({});
  });

  it("refuses an empty path list, an empty type, and no change at all", () => {
    expect(correctionBlockedReason(ARTIFACT, { ...correctionDraftFrom(ARTIFACT), paths: "" })).toBe("At least one path is required.");
    expect(correctionBlockedReason(ARTIFACT, { ...correctionDraftFrom(ARTIFACT), type: " " })).toBe("Type is required.");
    expect(correctionBlockedReason(ARTIFACT, correctionDraftFrom(ARTIFACT))).toBe("Nothing has changed.");
    expect(correctionBlockedReason(ARTIFACT, { ...correctionDraftFrom(ARTIFACT), usageBoundaries: "Now for review." })).toBeNull();
  });

  it("announces the changed fields in words, with the receipt", () => {
    expect(correctionAnnouncement("ART-1", { uri: "x", usage_boundaries: "y" }, { audit_range: [5, 5] })).toBe(
      "ART-1 corrected: paths, usage boundaries. Recorded as audit 5.",
    );
  });
});

describe("status", () => {
  it("guards on the loaded status and refuses the current one", () => {
    expect(buildStatusRequest(ARTIFACT, "review", "david")).toEqual({ status: "review", actor: "david", if_status: "draft" });
    expect(statusBlockedReason(ARTIFACT, "")).toMatch(/Choose/);
    expect(statusBlockedReason(ARTIFACT, "draft")).toBe("It is already draft.");
    expect(statusBlockedReason(ARTIFACT, "accepted")).toBeNull();
  });
});

describe("registration", () => {
  it("needs an id in the contract's grammar, a path, a type and an owner", () => {
    const draft = emptyRegistration("david");
    expect(registrationBlockedReason(draft)).toBe("An id is required.");
    expect(registrationBlockedReason({ ...draft, id: "-bad" })).toMatch(/must start with/);
    expect(registrationBlockedReason({ ...draft, id: "ART-9" })).toBe("At least one path is required.");
    expect(registrationBlockedReason({ ...draft, id: "ART-9", paths: "docs/x.md" })).toBe("Type is required.");
    expect(registrationBlockedReason({ ...draft, id: "ART-9", paths: "docs/x.md", type: "doc", owner: "" })).toBe("An owner is required.");
    expect(registrationBlockedReason({ ...draft, id: "ART-9", paths: "docs/x.md", type: "doc", tasks: "T-1 --x" })).toBe("--x is not an identifier.");
    expect(registrationBlockedReason({ ...draft, id: "ART-9", paths: "docs/x.md", type: "doc" })).toBeNull();
  });

  it("builds the add request with joined paths and split ids", () => {
    const body = buildRegistrationRequest({
      ...emptyRegistration("david"),
      id: " ART-9 ",
      paths: "docs/x.md\ndocs/y.md",
      type: "document",
      usageBoundaries: "Internal.",
      tasks: "T-1, T-2",
      reviewers: "alice",
    });
    expect(body).toEqual({
      id: "ART-9",
      uri: "docs/x.md, docs/y.md",
      owner: "david",
      type: "document",
      status: "draft",
      usage_boundaries: "Internal.",
      tasks: ["T-1", "T-2"],
      reviewers: ["alice"],
    });
  });
});
