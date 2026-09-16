import { describe, expect, it } from "vitest";
import type { Column } from "../components/DataTable.tsx";
import { orderByTerm } from "./requestOrder.ts";

const COLUMNS: Column<{ id: string }>[] = [
  { key: "id", orderBy: "id", header: "Id", render: (r) => r.id },
  { key: "title", header: "Title", render: (r) => r.id },
];

describe("orderByTerm", () => {
  it("names the contract column and the direction", () => {
    expect(orderByTerm(COLUMNS, { key: "id", direction: "desc" })).toBe("id:desc");
  });

  it("produces nothing for a header without orderBy, or no sort", () => {
    expect(orderByTerm(COLUMNS, { key: "title", direction: "asc" })).toBeUndefined();
    expect(orderByTerm(COLUMNS, null)).toBeUndefined();
  });
});
