/**
 * Paging announcements (UI-32).
 *
 * The defect was a live region that announced on every data change. The fix
 * must be narrow in both directions: silent when data arrives underneath the
 * operator, and still audible when they work the pager themselves. Both
 * halves are asserted, because deleting the region would pass the first.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagingAnnouncement } from "./usePagingAnnouncement.ts";

describe("usePagingAnnouncement", () => {
  it("says nothing on first render", () => {
    const { result } = renderHook(() => usePagingAnnouncement("Showing 1–10 of 61"));
    expect(result.current[0]).toBe("");
  });

  it("stays silent when the label changes on its own", () => {
    // A mutation refresh changing the row count must not speak.
    const { result, rerender } = renderHook(({ label }) => usePagingAnnouncement(label), {
      initialProps: { label: "Showing 1–10 of 61" },
    });
    rerender({ label: "Showing 1–10 of 62" });
    expect(result.current[0]).toBe("");
  });

  it("announces when the operator asked for the change", () => {
    const { result, rerender } = renderHook(({ label }) => usePagingAnnouncement(label), {
      initialProps: { label: "Showing 1–10 of 61" },
    });
    act(() => result.current[1]());
    rerender({ label: "Showing 11–20 of 61" });
    expect(result.current[0]).toBe("Showing 11–20 of 61");
  });

  it("clears again once data moves under a previous announcement", () => {
    // A stale range left in a live region gets re-read by some screen readers
    // when focus next enters it.
    const { result, rerender } = renderHook(({ label }) => usePagingAnnouncement(label), {
      initialProps: { label: "Showing 1–10 of 61" },
    });
    act(() => result.current[1]());
    rerender({ label: "Showing 11–20 of 61" });
    expect(result.current[0]).toBe("Showing 11–20 of 61");

    rerender({ label: "Showing 11–20 of 62" });
    expect(result.current[0]).toBe("");
  });

  it("does not latch: one request announces once", () => {
    const { result, rerender } = renderHook(({ label }) => usePagingAnnouncement(label), {
      initialProps: { label: "a" },
    });
    act(() => result.current[1]());
    rerender({ label: "b" });
    expect(result.current[0]).toBe("b");
    rerender({ label: "c" });
    expect(result.current[0]).toBe("");
  });

  it("announces each successive page the operator turns to", () => {
    const { result, rerender } = renderHook(({ label }) => usePagingAnnouncement(label), {
      initialProps: { label: "page 1" },
    });
    act(() => result.current[1]());
    rerender({ label: "page 2" });
    expect(result.current[0]).toBe("page 2");
    act(() => result.current[1]());
    rerender({ label: "page 3" });
    expect(result.current[0]).toBe("page 3");
  });
});
