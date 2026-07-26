import { describe, expect, it } from "vitest";
import { shortenDatabasePath } from "./DatabaseIdentity.tsx";

describe("shortenDatabasePath", () => {
  it("keeps only the coordination-relative portion", () => {
    expect(shortenDatabasePath("/Users/someone/work/proj/.coordination/coordination.sqlite3")).toBe(
      ".coordination/coordination.sqlite3",
    );
  });

  it("hides the local username and directory structure", () => {
    const shortened = shortenDatabasePath("/Users/joshnuez/workspace/x/.coordination/db.sqlite3");
    expect(shortened).not.toContain("joshnuez");
    expect(shortened).not.toContain("workspace");
  });

  it("keeps a nested database path under .coordination", () => {
    expect(shortenDatabasePath("/a/b/.coordination/nested/db.sqlite3")).toBe(
      ".coordination/nested/db.sqlite3",
    );
  });

  it("falls back to the last two segments outside a coordination tree", () => {
    expect(shortenDatabasePath("/var/lib/somewhere/other.sqlite3")).toBe("…/somewhere/other.sqlite3");
  });

  it("leaves an already-short path alone", () => {
    expect(shortenDatabasePath("db.sqlite3")).toBe("db.sqlite3");
  });

  it("handles an empty path", () => {
    expect(shortenDatabasePath("")).toBe("");
  });
});
