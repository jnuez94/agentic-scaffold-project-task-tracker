/**
 * Focus comes back from the task inspector and the forms inside it (UI-81):
 * to the queue row that opened the task, to the button that opened a form,
 * and — where nothing on the page opened it — to the nearest heading, never
 * the body.
 */

import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { stashEscalationIntent } from "../lib/escalationIntent.ts";
import { inspector, inspectorTitle, renderBoard } from "../test/taskInspectorHarness.tsx";

const focused = () => document.activeElement;
const row = (id: string) => screen.getByRole("button", { name: `Row ${id}` });

describe("the task inspector", () => {
  it("returns focus to the queue row that opened it", async () => {
    const { user } = renderBoard();
    await user.click(row("T-1"));
    await inspectorTitle();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(focused()).toBe(row("T-1")));
  });

  it("returns to the row of the task on screen, not the first one opened", async () => {
    const { user } = renderBoard();
    await user.click(row("T-1"));
    await inspectorTitle("T-1");
    await user.click(row("T-2"));
    await inspectorTitle("T-2");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(focused()).toBe(row("T-2")));
  });

  it("lands on the page heading when it was reached by deep link", async () => {
    const { user } = renderBoard("T-1");
    await inspectorTitle();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(focused()).toBe(screen.getByRole("heading", { name: "Tasks" })));
  });
});

type Close = (user: UserEvent, form: HTMLElement) => Promise<void>;
const cancel: Close = (user, form) => user.click(within(form).getByRole("button", { name: "Cancel" }));
const escape: Close = (user) => user.keyboard("{Escape}");

describe("the inline Escalate form", () => {
  const open = async () => {
    const harness = renderBoard("T-1");
    const panel = await inspector();
    await harness.user.click(within(panel).getByRole("button", { name: "Escalate…" }));
    const form = await screen.findByRole("region", { name: "Escalate" });
    return { ...harness, form, opener: () => within(panel).getByRole("button", { name: "Escalate…" }) };
  };

  it.each([
    ["Cancel", cancel],
    ["Escape", escape],
  ])("returns focus to Escalate… after %s", async (_path, close) => {
    const { user, form, opener } = await open();
    await close(user, form);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Escalate" })).toBeNull());
    await waitFor(() => expect(focused()).toBe(opener()));
  });

  it("returns focus to Escalate… after raising one", async () => {
    const { user, form, opener } = await open();
    await user.selectOptions(within(form).getByLabelText("Owner"), "michael-ux");
    await user.type(within(form).getByLabelText("Issue"), "stuck");
    await user.type(within(form).getByLabelText("Requested decision"), "unblock");
    await user.click(within(form).getByRole("button", { name: "Raise escalation" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Escalate" })).toBeNull());
    await waitFor(() => expect(focused()).toBe(opener()));
  });

  it("opened from Health, with no button of its own, hands focus to the task's title", async () => {
    stashEscalationIntent({ taskId: "T-1", issue: "" });
    const { user } = renderBoard("T-1");
    await screen.findByRole("region", { name: "Escalate" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Escalate" })).toBeNull());
    expect(focused()).toBe(await inspectorTitle());
  });
});

describe("the inline Add evidence form", () => {
  const open = async () => {
    const harness = renderBoard("T-1");
    const panel = await inspector();
    await harness.user.click(within(panel).getByRole("tab", { name: /^Evidence/ }));
    await harness.user.click(within(panel).getByRole("button", { name: "Add evidence" }));
    const uri = await within(panel).findByLabelText("Evidence URI");
    return { ...harness, panel, uri, opener: () => document.getElementById("add-evidence-trigger") };
  };

  it("starts in its first field, since it replaces the button that opened it", async () => {
    const { uri } = await open();
    expect(focused()).toBe(uri);
  });

  it.each([
    ["Cancel", cancel],
    ["Escape", escape],
  ])("returns focus to Add evidence, rendered anew, after %s", async (_path, close) => {
    const { user, panel, opener } = await open();
    await close(user, panel);
    await waitFor(() => expect(opener()).not.toBeNull());
    await waitFor(() => expect(focused()).toBe(opener()));
  });

  it("returns focus to Add evidence after adding one", async () => {
    const { user, panel, uri, opener } = await open();
    await user.type(uri, "git:abc123");
    await user.click(within(panel).getAllByRole("button", { name: "Add evidence" }).at(-1)!);
    await waitFor(() => expect(opener()).not.toBeNull());
    await waitFor(() => expect(focused()).toBe(opener()));
  });
});

describe("the inline assignee editor", () => {
  it("returns focus to Change assignees after Cancel", async () => {
    const { user } = renderBoard("T-1");
    const panel = await inspector();
    await user.click(within(panel).getByRole("button", { name: "Change assignees" }));
    await user.click(await within(panel).findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(focused()).toBe(within(panel).getByRole("button", { name: "Change assignees" })));
  });
});
