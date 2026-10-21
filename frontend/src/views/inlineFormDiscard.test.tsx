/**
 * Escape on an inline form asks before it throws away typed input (UI-81):
 * "Discard this draft?" with Keep editing and Discard. Nothing typed, it
 * closes at once; Cancel never asks, because pressing it is the choice.
 */

import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inspector, renderBoard } from "../test/taskInspectorHarness.tsx";

const prompt = () => screen.queryByRole("alertdialog", { name: "Discard this draft?" });
const escalateForm = () => screen.queryByRole("region", { name: "Escalate" });

async function openEscalate() {
  const harness = renderBoard("T-1");
  const panel = await inspector();
  await harness.user.click(within(panel).getByRole("button", { name: "Escalate…" }));
  const form = await screen.findByRole("region", { name: "Escalate" });
  const issue = within(form).getByLabelText("Issue");
  return { ...harness, panel, form, issue };
}

describe("Escape on the Escalate form with an issue typed", () => {
  it("asks, with Keep editing focused as the safe answer", async () => {
    const { user, issue } = await openEscalate();
    await user.type(issue, "stuck on review");
    await user.keyboard("{Escape}");

    expect(prompt()).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep editing" }));
    expect(escalateForm()).toBeTruthy();
  });

  it("keeps the draft and returns to the field on Keep editing", async () => {
    const { user, issue } = await openEscalate();
    await user.type(issue, "stuck on review");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(prompt()).toBeNull();
    expect((issue as HTMLTextAreaElement).value).toBe("stuck on review");
    await waitFor(() => expect(document.activeElement).toBe(issue));
  });

  it("answers Keep editing to a second Escape", async () => {
    const { user, issue } = await openEscalate();
    await user.type(issue, "stuck on review");
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");

    expect(prompt()).toBeNull();
    expect(escalateForm()).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(issue));
  });

  it("closes on Discard and hands focus back to Escalate…", async () => {
    const { user, panel, issue } = await openEscalate();
    await user.type(issue, "stuck on review");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(escalateForm()).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(panel).getByRole("button", { name: "Escalate…" })),
    );
  });
});

describe("closing without the question", () => {
  it("closes at once on Escape when nothing was typed", async () => {
    const { user } = await openEscalate();
    await user.keyboard("{Escape}");
    expect(prompt()).toBeNull();
    expect(escalateForm()).toBeNull();
  });

  it("never asks on Cancel, typed or not", async () => {
    const { user, form, issue } = await openEscalate();
    await user.type(issue, "stuck on review");
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(prompt()).toBeNull();
    expect(escalateForm()).toBeNull();
  });
});

describe("Escape on the Add evidence form with a reference typed", () => {
  it("asks too, and Discard closes it", async () => {
    const { user } = renderBoard("T-1");
    const panel = await inspector();
    await user.click(within(panel).getByRole("tab", { name: /^Evidence/ }));
    await user.click(within(panel).getByRole("button", { name: "Add evidence" }));
    await user.type(await within(panel).findByLabelText("Evidence URI"), "git:abc123");
    await user.keyboard("{Escape}");

    expect(prompt()).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(within(panel).queryByLabelText("Evidence URI")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("add-evidence-trigger")));
  });
});
