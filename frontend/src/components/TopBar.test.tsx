/**
 * The top bar's identity treatment (UI-43).
 *
 * The bar was 165px tall, 16% of the viewport permanently, with the two
 * identity selects holding 68% of its width for a value set once. Identity is
 * now a readout that expands.
 *
 * Two properties matter more than the layout and are asserted here because
 * neither is visible in a screenshot: attribution is never hidden, and the
 * selects stay reachable rather than being removed.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Agent, Session } from "../api/contract.ts";
import { TopBar } from "./TopBar.tsx";

const agent = (over: Partial<Agent> = {}): Agent => ({
  id: "local-operator",
  name: "Local Operator",
  role: "Operator",
  status: "active",
  actor_type: "human",
  responsibilities: "",
  goal: "",
  operating_style: "",
  decision_authority: "",
  review_authority: "",
  escalation_rules: "",
  unavailable_for: "",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  ...over,
});

const session = (over: Partial<Session> = {}): Session => ({
  id: "console-1",
  agent_id: "local-operator",
  harness: "coordination-console",
  model: "",
  status: "active",
  started_at: "2026-08-01T00:00:00Z",
  last_seen_at: "2026-08-01T00:00:00Z",
  ended_at: null,
  ...over,
});

function renderBar(over: Partial<Parameters<typeof TopBar>[0]> = {}) {
  render(
    <TopBar
      filter=""
      onFilter={vi.fn()}
      filterPlaceholder="Filter loaded rows"
      agents={[agent()]}
      sessions={[session()]}
      actorId="local-operator"
      sessionId="console-1"
      onActor={vi.fn()}
      onSession={vi.fn()}
      onRefresh={vi.fn()}
      lastUpdated={undefined}
      busy={false}
      sessionReason={null}
      broadcastRef={createRef<HTMLButtonElement>()}
      broadcastDisabledReason={null}
      onBroadcast={vi.fn()}
      {...over}
    />,
  );
}

describe("top bar identity", () => {
  it("states who is acting without being expanded", () => {
    // Accountability is never behind a click: the product is about attributable
    // action, so the collapsed readout still names the actor and the session.
    renderBar();
    const readout = screen.getByRole("button", { name: /Acting as/ });
    expect(readout.textContent).toContain("Local Operator");
    expect(readout.textContent).toContain("console-1");
  });

  it("says so plainly when there is no actor or session", () => {
    renderBar({ actorId: null, sessionId: null });
    const readout = screen.getByRole("button", { name: /Acting as/ });
    expect(readout.textContent).toContain("No actor");
    expect(readout.textContent).toContain("no session");
  });

  it("starts collapsed", () => {
    renderBar();
    expect(
      screen.getByRole("button", { name: /Acting as/ }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("expands to the two selects, which are not removed", () => {
    renderBar();
    // Present in the DOM either way — CSS governs visibility — so the check
    // that matters is that expanding is what a reader is told to do.
    expect(screen.getByLabelText("Acting as")).toBeTruthy();
    expect(screen.getByLabelText("Active session")).toBeTruthy();
  });

  it("toggles on activation", async () => {
    const user = userEvent.setup();
    renderBar();
    const readout = screen.getByRole("button", { name: /Acting as/ });
    await user.click(readout);
    expect(readout.getAttribute("aria-expanded")).toBe("true");
    await user.click(readout);
    expect(readout.getAttribute("aria-expanded")).toBe("false");
  });

  it("points the readout at the region it controls", () => {
    renderBar();
    const readout = screen.getByRole("button", { name: /Acting as/ });
    const controls = readout.getAttribute("aria-controls");
    expect(controls).toBe("topbar-identity");
    expect(document.getElementById(controls!)).toBeTruthy();
  });

  it("keeps Broadcast reachable but no longer primary (UI-12, UI-43)", () => {
    renderBar();
    const broadcast = screen.getByRole("button", { name: /Broadcast to team/ });
    // Globally reachable is the UI-12 requirement; loudest control on screen
    // was not, and broadcasting is rare while opening a task is constant.
    expect(broadcast.className).not.toContain("primary");
  });

  it("still disables Broadcast with its reason when identity is incomplete", () => {
    renderBar({ broadcastDisabledReason: "Select an actor first" });
    const broadcast = screen.getByRole("button", { name: /Broadcast to team/ });
    expect((broadcast as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Select an actor first")).toBeTruthy();
  });
});
