import { describe, expect, it } from "vitest";
import { ROUTES, ROUTE_ENTRY_SCROLL } from "./useHashRoute.ts";

describe("ROUTE_ENTRY_SCROLL", () => {
  it("declares an entry intent for every route", () => {
    for (const route of ROUTES) {
      expect(ROUTE_ENTRY_SCROLL[route], `${route} has no declared entry scroll`).toBeDefined();
    }
  });

  // The defect: `.content` is shared across routes, so a scroll offset from one
  // route survived into the next and was merely clamped to its maximum. Every
  // route that does not manage its own entry position must be reset.
  it("resets to the top on every route except the one that manages itself", () => {
    const selfManaged = ROUTES.filter((r) => ROUTE_ENTRY_SCROLL[r] === "self-managed");
    expect(selfManaged).toEqual(["messages"]);
  });

  it("keeps Messages self-managed so it can open at its newest entry", () => {
    expect(ROUTE_ENTRY_SCROLL.messages).toBe("self-managed");
  });

  it("resets the routes the defect was reproduced on", () => {
    // Reproduced at 1440x1024: scroll Tasks to its bottom, and Decisions then
    // opened at its own bottom with Artifacts and Reviews partway down.
    for (const route of ["tasks", "decisions", "artifacts", "reviews"] as const) {
      expect(ROUTE_ENTRY_SCROLL[route]).toBe("top");
    }
  });
});
