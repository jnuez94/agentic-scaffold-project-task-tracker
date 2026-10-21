/**
 * A row-action column appears only when at least one loaded row qualifies
 * (UI-40). Sessions' Recovery column held 83px to show ten dashes while no
 * session was stale.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "../components/DataTable.tsx";
import { withActionColumn } from "./recordActionColumn.tsx";
import { RECORD_CONFIGS } from "./recordConfigs.tsx";

const config = RECORD_CONFIGS.sessions!;
const LONG_AGO = "2026-01-01T00:00:00+00:00";

const session = (id: string, last_seen_at: string, status = "active") => ({
  id,
  agent_id: "david",
  harness: "codex",
  model: "",
  status,
  started_at: LONG_AGO,
  last_seen_at,
  ended_at: null,
});

function table(rows: Record<string, unknown>[]) {
  render(
    <DataTable
      rows={rows as never[]}
      columns={withActionColumn(config, vi.fn())}
      rowKey={(row: Record<string, unknown>) => String(row["id"])}
      caption="Sessions"
      idPrefix="sessions"
    />,
  );
}

const headers = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent ?? "");

describe("the Recovery column", () => {
  it("is absent when no loaded session can be recovered", () => {
    table([session("s-1", new Date().toISOString()), session("s-2", LONG_AGO, "ended")]);
    expect(headers().some((text) => text.includes("Recovery"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Recover…" })).toBeNull();
  });

  it("appears once one session is stale, with a dash on the rest", () => {
    table([session("s-1", new Date().toISOString()), session("s-2", LONG_AGO)]);
    expect(headers().some((text) => text.includes("Recovery"))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Recover…" })).toHaveLength(1);
    const fresh = screen.getByText("s-1").closest("tr")!;
    const cells = fresh.querySelectorAll("td");
    expect(cells[cells.length - 1]!.textContent).toBe("—");
  });
});
