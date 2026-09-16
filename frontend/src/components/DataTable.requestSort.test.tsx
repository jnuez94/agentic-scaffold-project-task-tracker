/**
 * Two kinds of sort, told apart (UI-70): a header that orders the request
 * asks the owner for `--order-by` and leaves the rows alone; any other header
 * sorts what was loaded, as before.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./DataTable.tsx";

type Row = { id: string; note: string };
const ROWS: Row[] = [
  { id: "b", note: "zeta" },
  { id: "a", note: "alpha" },
];
const COLUMNS: Column<Row>[] = [
  { key: "id", orderBy: "id", header: "Id", render: (r) => r.id, sortValue: (r) => r.id },
  { key: "note", header: "Note", render: (r) => r.note, sortValue: (r) => r.note },
];

const firstCell = () => screen.getAllByRole("row")[1]!.textContent;

describe("DataTable with requestSort", () => {
  it("asks for the request order on an orderable header and does not reorder locally", async () => {
    const onChange = vi.fn();
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="Things"
        requestSort={{ state: null, onChange }}
        paginate={false}
      />,
    );
    expect(screen.getByRole("button", { name: /^Id/ }).title).toBe("Sort the request by Id, ascending");
    await userEvent.click(screen.getByRole("button", { name: /^Id/ }));
    expect(onChange).toHaveBeenCalledWith({ key: "id", direction: "asc" });
    expect(firstCell()).toContain("b");
  });

  it("still sorts loaded rows on a header without orderBy, and says so", async () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="Things"
        requestSort={{ state: null, onChange: () => {} }}
        paginate={false}
      />,
    );
    const note = screen.getByRole("button", { name: /^Note/ });
    expect(note.title).toBe("Sort loaded rows by Note, ascending");
    await userEvent.click(note);
    expect(firstCell()).toContain("alpha");
  });

  it("shows the request order in the header state and the caption", () => {
    render(
      <DataTable
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        caption="Things"
        requestSort={{ state: { key: "id", direction: "desc" }, onChange: () => {} }}
        paginate={false}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Id/ }).getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByText(/requested in Id descending order/)).toBeTruthy();
  });
});
