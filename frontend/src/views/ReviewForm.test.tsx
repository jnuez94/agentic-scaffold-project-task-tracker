/**
 * Recording a review (UI-52).
 *
 * Pins the ruling: required_changes and blocked_claims are mandatory for every
 * decision; reviewer is the acting actor, read-only; the wire shape carries
 * the CLI's required fields and the task.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TaskDetail } from "../api/contract.ts";
import { ApiClient } from "../api/client.ts";
import { AppProvider } from "../state/AppContext.tsx";
import { IdentityStore } from "../state/identityStore.ts";
import { ReviewForm } from "./ReviewForm.tsx";

const DETAIL = {
  id: "UI-42",
  evidence: [{ uri: "commit:111" }, { uri: "commit:82f16a0" }],
} as unknown as TaskDetail;
const EXISTING = [{ id: "REVIEW-UI42-1" }];

function renderForm(post?: () => Promise<Response>) {
  const sent: Record<string, unknown>[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/reviews" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      return post
        ? post()
        : new Response(JSON.stringify({ ok: true, data: { id: body["id"] } }), { status: 200 });
    }
    if (path.startsWith("/api/reviews")) {
      return new Response(JSON.stringify({ ok: true, data: EXISTING }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const store = new IdentityStore(null);
  store.save({ actorId: "local-operator", sessionId: "console-1" });
  const onRecorded = vi.fn();
  render(
    <AppProvider store={store} client={new ApiClient(() => "console-1", "", fetchImpl)}>
      <ReviewForm detail={DETAIL} onRecorded={onRecorded} />
    </AppProvider>,
  );
  return { sent, onRecorded };
}

const record = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = await screen.findByRole<HTMLButtonElement>("button", { name: /Record review/ });
  await waitFor(() => expect(button.disabled).toBe(false));
  await user.click(button);
};

const fillMandatory = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Scope"), "the attention strip");
  await user.type(screen.getByLabelText("Required changes"), "none");
  await user.type(screen.getByLabelText("Does not authorize"), "release");
};

describe("ReviewForm", () => {
  it("suggests an id continuing the task's review prefix, and pre-fills the latest evidence", async () => {
    renderForm();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("REVIEW-UI42-2"),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Artifact").value).toBe("commit:82f16a0");
  });

  it("shows the reviewer as the acting actor, read-only", async () => {
    renderForm();
    const reviewer = screen.getByLabelText<HTMLInputElement>("Reviewer");
    await waitFor(() => expect(reviewer.value).toBe("local-operator"));
    expect(reviewer.readOnly).toBe(true);
  });

  it("offers every decision the CLI accepts, by label", () => {
    renderForm();
    const labels = [...screen.getByLabelText<HTMLSelectElement>("Decision").options].map((o) => o.textContent);
    expect(labels).toEqual(["Accepted", "Conditionally accepted", "Changes requested", "Rejected"]);
  });

  it("refuses an accepted review without required changes, and sends nothing", async () => {
    const user = userEvent.setup();
    const { sent } = renderForm();
    await user.type(screen.getByLabelText("Scope"), "x");
    await user.type(screen.getByLabelText("Does not authorize"), "release");
    await record(user);
    expect(screen.getByLabelText("Required changes").getAttribute("aria-invalid")).toBe("true");
    expect(sent).toHaveLength(0);
  });

  it("refuses without a stated boundary — even for accepted", async () => {
    const user = userEvent.setup();
    const { sent } = renderForm();
    await user.type(screen.getByLabelText("Scope"), "x");
    await user.type(screen.getByLabelText("Required changes"), "none");
    await record(user);
    expect(screen.getByLabelText("Does not authorize").getAttribute("aria-invalid")).toBe("true");
    expect(sent).toHaveLength(0);
  });

  it("sends the CLI's required fields, the task, and the two mandatory ones", async () => {
    const user = userEvent.setup();
    const { sent, onRecorded } = renderForm();
    await fillMandatory(user);
    await user.selectOptions(screen.getByLabelText("Decision"), "conditionally_accepted");
    await record(user);
    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(sent[0]).toMatchObject({
      task: "UI-42",
      reviewer: "local-operator",
      artifact: "commit:82f16a0",
      scope: "the attention strip",
      decision: "conditionally_accepted",
      required_changes: "none",
      blocked_claims: "release",
    });
  });

  it("clears the draft for the next review after recording, keeping the task's context", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillMandatory(user);
    await record(user);
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>("Scope").value).toBe(""));
    // The next suggested id advances past the one just recorded.
    expect(screen.getByLabelText<HTMLInputElement>("Id").value).toBe("REVIEW-UI42-3");
  });

  it("surfaces a duplicate-id refusal from the CLI on the id field and keeps the draft", async () => {
    const user = userEvent.setup();
    const { onRecorded } = renderForm(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "constraint_violation",
              message: "Coordination constraint failed",
              details: { database_error: "UNIQUE constraint failed: reviews.id" },
            },
          }),
          { status: 409 },
        ),
    );
    await fillMandatory(user);
    await record(user);
    expect((await screen.findByRole("alert")).textContent).toContain("already exists");
    expect(screen.getByLabelText<HTMLInputElement>("Scope").value).toBe("the attention strip");
    expect(onRecorded).not.toHaveBeenCalled();
  });
});
