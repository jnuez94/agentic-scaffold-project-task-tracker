import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "./RouteErrorBoundary.tsx";

function Boom({ fail }: { fail: boolean }) {
  if (fail) throw new Error("Cannot read properties of undefined (reading 'join')");
  return <p>view content</p>;
}

// React logs caught render errors itself; silence only that noise, and keep the
// boundary's own componentDidCatch call observable.
let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("RouteErrorBoundary", () => {
  it("renders its children when nothing fails", () => {
    render(
      <RouteErrorBoundary resetKey="tasks">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("view content")).toBeTruthy();
  });

  it("shows a fallback instead of unmounting when a child throws", () => {
    render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "This view could not be displayed" })).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("tells the operator no coordination write was lost", () => {
    // The distinction that matters in a tool whose whole purpose is recording
    // decisions: a drawing failure is not a lost write.
    render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText(/Nothing was sent or changed by this error/)).toBeTruthy();
  });

  it("surfaces the underlying message rather than hiding it", () => {
    render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText(/reading 'join'/)).toBeTruthy();
  });

  it("still reports the failure to the console", () => {
    render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    // Swallowing this is how a render bug becomes a mystery blank screen.
    expect(logged.some((line) => line.includes("Route render failed"))).toBe(true);
  });

  it("recovers when the operator retries", async () => {
    function Flaky() {
      return <Boom fail={Flaky.shouldFail} />;
    }
    Flaky.shouldFail = true;

    render(
      <RouteErrorBoundary resetKey="artifacts">
        <Flaky />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "This view could not be displayed" })).toBeTruthy();

    Flaky.shouldFail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try this view again" }));
    expect(screen.getByText("view content")).toBeTruthy();
  });

  it("clears the error when the route changes", () => {
    const { rerender } = render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "This view could not be displayed" })).toBeTruthy();

    // Navigating away is the operator's other escape route, and it must not
    // strand them on the fallback of a view they have left.
    rerender(
      <RouteErrorBoundary resetKey="tasks">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("view content")).toBeTruthy();
  });

  it("keeps showing the fallback while the route is unchanged", () => {
    const { rerender } = render(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={true} />
      </RouteErrorBoundary>,
    );
    rerender(
      <RouteErrorBoundary resetKey="artifacts">
        <Boom fail={false} />
      </RouteErrorBoundary>,
    );
    // An unrelated re-render is not evidence the view was fixed; only retry or
    // navigation clears it.
    expect(screen.getByRole("heading", { name: "This view could not be displayed" })).toBeTruthy();
  });
});
