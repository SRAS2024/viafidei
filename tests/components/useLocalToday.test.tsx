/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { localIsoDate, useLocalToday, useVisitDay } from "@/components/ui/useLocalToday";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Shown() {
  return <p>{useLocalToday() ?? "not read yet"}</p>;
}

const shown = () => screen.getByText(/^\d{4}-\d{2}-\d{2}$/).textContent;

describe("useLocalToday", () => {
  it("is the device's own date, not UTC's", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 23, 30));
    render(<Shown />);
    expect(shown()).toBe("2026-11-06");
    expect(localIsoDate(new Date(2026, 0, 2, 0, 0))).toBe("2026-01-02");
  });

  it("is not read on the server, so the first render matches it", () => {
    expect(renderToStaticMarkup(<Shown />)).toBe("<p>not read yet</p>");
  });

  it("moves at local midnight, and at the midnight after that", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59, 30));
    render(<Shown />);
    expect(shown()).toBe("2026-11-07");

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(shown()).toBe("2026-11-07");
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(shown()).toBe("2026-11-08");

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60_000);
    });
    expect(shown()).toBe("2026-11-09");
  });

  it("finds the right midnight across a clock change", () => {
    vi.useFakeTimers();
    // The Sunday clocks go back in much of the Americas is 25 hours long there, and a
    // fixed 24 hours would land before midnight wherever the test runs.
    vi.setSystemTime(new Date(2026, 10, 1, 0, 0, 30));
    render(<Shown />);
    const midnight = new Date(2026, 10, 2).getTime();
    act(() => {
      vi.advanceTimersByTime(midnight - Date.now() - 1);
    });
    expect(shown()).toBe("2026-11-01");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(shown()).toBe("2026-11-02");
  });

  it.each([
    ["coming back to the tab", () => document.dispatchEvent(new Event("visibilitychange"))],
    ["the window's focus", () => window.dispatchEvent(new Event("focus"))],
    [
      "the back/forward cache",
      () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    ],
  ])("is read again on %s, when a sleeping device has missed midnight", (_how, wake) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    render(<Shown />);
    expect(shown()).toBe("2026-11-07");
    act(() => {
      // The clock moves on while the timers do not, as they stop during sleep.
      vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
      wake();
    });
    expect(shown()).toBe("2026-11-08");
    // And the next midnight is still kept, from the time it woke.
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 60_000);
    });
    expect(shown()).toBe("2026-11-09");
  });

  it("leaves nothing behind when it is gone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    const { unmount } = render(<Shown />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    window.dispatchEvent(new Event("focus"));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useVisitDay", () => {
  function Visit() {
    return <p>{useVisitDay() ?? "not read yet"}</p>;
  }

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("is not read on the server, so the first render matches it", () => {
    expect(renderToStaticMarkup(<Visit />)).toBe("<p>not read yet</p>");
  });

  it("is the device's own date on arrival, and does not move at midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59));
    render(<Visit />);
    expect(shown()).toBe("2026-11-07");
    act(() => {
      vi.advanceTimersByTime(48 * 60 * 60_000);
    });
    expect(shown()).toBe("2026-11-07");
  });

  it("sets no timer to do so", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59));
    render(<Visit />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not move for a moment away from the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 50));
    render(<Visit />);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 0, 5));
      window.dispatchEvent(new Event("blur"));
      vi.setSystemTime(new Date(2026, 10, 8, 0, 34));
      window.dispatchEvent(new Event("focus"));
    });
    expect(shown()).toBe("2026-11-07");
  });

  it("takes a moment away as a moment, by whichever of its events it goes and comes back", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 50));
    render(<Visit />);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 0, 5));
      setHidden(true);
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("pagehide"));
      vi.setSystemTime(new Date(2026, 10, 8, 0, 7));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      setHidden(false);
      window.dispatchEvent(new Event("focus"));
    });
    expect(shown()).toBe("2026-11-07");
  });

  it("counts from the first sign of leaving, however late the next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 23, 50));
    render(<Visit />);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 0, 5));
      window.dispatchEvent(new Event("blur"));
      // The window behind another all night, until the screen locked before dawn.
      vi.setSystemTime(new Date(2026, 10, 8, 5, 0));
      setHidden(true);
      vi.setSystemTime(new Date(2026, 10, 8, 5, 10));
      setHidden(false);
    });
    expect(shown()).toBe("2026-11-08");
  });

  it.each([
    ["the tab", () => setHidden(true), () => setHidden(false)],
    [
      "the window",
      () => window.dispatchEvent(new Event("blur")),
      () => window.dispatchEvent(new Event("focus")),
    ],
    [
      "the back/forward cache",
      () => window.dispatchEvent(new Event("pagehide")),
      () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    ],
  ])("moves when the visitor comes back to %s after being away a while", (_how, leave, back) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    render(<Visit />);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 0, 30));
      leave();
      vi.setSystemTime(new Date(2026, 10, 8, 8, 0));
      back();
    });
    expect(shown()).toBe("2026-11-08");
  });

  it("moves if it never saw the visitor go, once a day has passed", () => {
    // A tab opened in the background has no blur to report.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    render(<Visit />);
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 8, 21, 0));
      window.dispatchEvent(new Event("focus"));
    });
    expect(shown()).toBe("2026-11-08");
  });

  it("listens for nothing once it is gone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 21, 0));
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Visit />);
    unmount();
    const names = removed.mock.calls.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(["blur", "pagehide", "focus", "pageshow"]));
    removed.mockRestore();
  });
});
