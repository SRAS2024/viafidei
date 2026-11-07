/**
 * @vitest-environment jsdom
 */
/**
 * The year slider, the timeline's one interactive island: the readout follows the
 * thumb; the list follows when the thumb is let go, or shortly after the last key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The same object every time, as the real router is.
const { push, replace, router } = vi.hoisted(() => {
  const push = vi.fn();
  const replace = vi.fn();
  return { push, replace, router: { push, replace } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { HistoryShell } from "@/app/history/HistoryShell";
import { HistoryYearSlider } from "@/app/history/HistoryYearSlider";
import { HISTORY_ERAS } from "@/lib/content-shared/church-history/types";

const eras = HISTORY_ERAS.map(({ key, label, from, to }) => ({ key, label, from, to }));

function renderSlider(props: Partial<Parameters<typeof HistoryYearSlider>[0]> = {}) {
  const all = {
    min: 33,
    max: 2026,
    value: 1000,
    valueEraLabel: null,
    eras,
    keep: { theme: "councils", q: "rome", order: "oldest" },
    ...props,
  };
  return {
    all,
    ...render(
      <HistoryShell>
        <HistoryYearSlider {...all} />
      </HistoryShell>,
    ),
  };
}

const slider = () => screen.getByRole("slider");
const readout = (c: HTMLElement) => c.querySelector(".vf-history-readout")?.textContent;

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/history");
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("HistoryYearSlider", () => {
  it("does nothing when the thumb is pressed and let go where it was", () => {
    renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.pointerUp(window);
    expect(push).not.toHaveBeenCalled();
  });

  it("goes back to the server's year when the browser takes the pointer for a scroll", () => {
    renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.change(slider(), { target: { value: "1200" } });
    fireEvent.pointerCancel(window);
    expect(slider()).toHaveValue("1000");
    expect(push).not.toHaveBeenCalled();
  });

  it("reads the year and era aloud, and shows them", () => {
    const { container } = renderSlider();
    expect(slider()).toHaveValue("1000");
    expect(slider()).toHaveAttribute("aria-valuetext", "1000, Early Middle Ages");
    expect(readout(container)).toBe("1000, Early Middle Ages");
  });

  it("trusts the era of the event the server stands on, until the thumb moves", () => {
    const { container } = renderSlider({ value: 1648, valueEraLabel: "Reformation & Trent" });
    expect(readout(container)).toBe("1648, Reformation & Trent");
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(readout(container)).toBe("1653, Missions & Enlightenment");
  });

  it("steps five years with the arrow keys and one year with Shift, never past the ends", () => {
    const { container } = renderSlider();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(slider()).toHaveValue("1005");
    fireEvent.keyDown(slider(), { key: "ArrowLeft", shiftKey: true });
    expect(slider()).toHaveValue("1004");
    fireEvent.keyDown(slider(), { key: "ArrowUp" });
    expect(slider()).toHaveValue("1009");
    fireEvent.keyDown(slider(), { key: "ArrowDown", shiftKey: true });
    expect(slider()).toHaveValue("1008");
    expect(readout(container)).toBe("1008, Early Middle Ages");
    cleanup();

    renderSlider({ value: 2025 });
    fireEvent.keyDown(slider(), { key: "ArrowUp" });
    expect(slider()).toHaveValue("2026");
    cleanup();

    renderSlider({ value: 34 });
    fireEvent.keyDown(slider(), { key: "ArrowDown" });
    expect(slider()).toHaveValue("33");
  });

  it("moves the list shortly after the last key, not on every key", () => {
    renderSlider();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      "/history?theme=councils&q=rome&year=1015#history-year-target",
      { scroll: false },
    );
  });

  it("moves the list at once on Enter, and not at all if the year is where it was", () => {
    renderSlider();
    fireEvent.keyDown(slider(), { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.keyDown(slider(), { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("follows the thumb while it is dragged and moves the list when it is let go", () => {
    const { container } = renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.change(slider(), { target: { value: "1200" } });
    expect(readout(container)).toBe("1200, High Middle Ages");
    fireEvent.change(slider(), { target: { value: "1500" } });
    expect(readout(container)).toBe("1500, Western Schism & Renaissance");
    act(() => vi.advanceTimersByTime(5000));
    expect(push).not.toHaveBeenCalled();
    // Let go anywhere: off the track counts.
    fireEvent.pointerUp(window);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[0]).toContain("year=1500");
  });

  it("gives VoiceOver's swipe, which arrives with no key or pointer, time to swipe again", () => {
    renderSlider();
    fireEvent.change(slider(), { target: { value: "1100" } });
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.change(slider(), { target: { value: "1200" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[0]).toContain("year=1200");
  });

  it("shares one history entry between repeated moves", () => {
    window.history.replaceState(null, "", "/history?year=1000");
    renderSlider();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    fireEvent.keyDown(slider(), { key: "Enter" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("follows the server when the view changes, unless a move is on its way", () => {
    const { all, rerender } = renderSlider();
    const again = (value: number) =>
      rerender(
        <HistoryShell>
          <HistoryYearSlider {...all} value={value} />
        </HistoryShell>,
      );
    again(1500);
    expect(slider()).toHaveValue("1500");
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    again(33);
    expect(slider()).toHaveValue("1505");
  });
});
