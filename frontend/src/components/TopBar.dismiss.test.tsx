/**
 * The identity popover closes every way an overlay should (UI-77).
 *
 * It sat over page content and closed only from its readout. Reviewing on the
 * live board, a click meant for the inbox's "Mark all as read" landed on the
 * popover beside End session; an inch the other way would have ended the
 * reviewer's session. Each close path is asserted here, along with the press
 * outside being spent on closing rather than reaching what is beneath.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Agent, Session } from "../api/contract.ts";
import { TopBar, type TopBarProps } from "./TopBar.tsx";

const agent = (id: string, name: string): Agent => ({
  id,
  name,
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
});

const SESSION: Session = {
  id: "console-1",
  agent_id: "local-operator",
  harness: "coordination-console",
  model: "",
  status: "active",
  started_at: "2026-08-01T00:00:00Z",
  last_seen_at: "2026-08-01T00:00:00Z",
  ended_at: null,
};

function props(over: Partial<TopBarProps> = {}): TopBarProps {
  return {
    filter: "",
    onFilter: vi.fn(),
    filterPlaceholder: "Filter loaded rows",
    agents: [agent("local-operator", "Local Operator"), agent("david", "David")],
    sessions: [SESSION],
    actorId: "local-operator",
    sessionId: "console-1",
    onActor: vi.fn(),
    onSession: vi.fn(),
    onRefresh: vi.fn(),
    lastUpdated: undefined,
    busy: false,
    sessionReason: null,
    broadcastRef: createRef<HTMLButtonElement>(),
    broadcastDisabledReason: null,
    onBroadcast: vi.fn(),
    routeKey: "tasks/",
    ...over,
  };
}

const readout = () => screen.getByRole("button", { name: /Acting as/ });
const isOpen = () => readout().getAttribute("aria-expanded") === "true";

async function openBar(over: Partial<TopBarProps> = {}) {
  const bar = props(over);
  const view = render(<TopBar {...bar} />);
  await userEvent.click(readout());
  expect(isOpen()).toBe(true);
  return { bar, view };
}

describe("identity popover dismissal", () => {
  it("closes on Escape from the readout and keeps focus there", async () => {
    await openBar();
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(readout());
  });

  it.each(["Acting as", "Active session"])(
    "closes on Escape from the %s select and returns focus to the readout",
    async (label) => {
      await openBar();
      screen.getByLabelText(label, { selector: "select" }).focus();
      await userEvent.keyboard("{Escape}");
      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(readout());
    },
  );

  it("closes on a press outside, and that press activates nothing beneath", async () => {
    const { bar } = await openBar();
    const broadcast = screen.getByRole("button", { name: "Broadcast to team" });

    await userEvent.click(broadcast);
    expect(isOpen()).toBe(false);
    expect(bar.onBroadcast).not.toHaveBeenCalled();

    await userEvent.click(broadcast);
    expect(bar.onBroadcast).toHaveBeenCalledTimes(1);
  });

  it("closes when the route changes", async () => {
    const { bar, view } = await openBar();
    view.rerender(<TopBar {...bar} routeKey="messages/" />);
    expect(isOpen()).toBe(false);
  });

  it("stays open while an actor and then a session are chosen", async () => {
    const { bar } = await openBar();
    await userEvent.selectOptions(screen.getByLabelText("Acting as", { selector: "select" }), "david");
    expect(bar.onActor).toHaveBeenCalledWith("david");
    expect(isOpen()).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText("Active session", { selector: "select" }), "");
    expect(bar.onSession).toHaveBeenCalledWith(null);
    expect(isOpen()).toBe(true);
  });

  it("still closes from the readout itself", async () => {
    await openBar();
    await userEvent.click(readout());
    expect(isOpen()).toBe(false);
  });
});
