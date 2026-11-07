/**
 * @vitest-environment jsdom
 */
/**
 * The year slider, the timeline's one interactive island: the readout follows the
 * thumb; the list follows when the thumb is let go, or shortly after the last key.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
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
import { createTranslator } from "@/lib/i18n/translator";

const eras = HISTORY_ERAS.map(({ key, label, from, to }) => ({ key, label, from, to }));
const t = createTranslator("en");
const labels = { box: t("history.yearBox"), hint: t("history.sliderHint", { years: 5 }) };

function renderSlider(props: Partial<Parameters<typeof HistoryYearSlider>[0]> = {}) {
  const all = {
    min: 33,
    max: 2026,
    value: 1000,
    valueEraLabel: null,
    eras,
    keep: { theme: "councils", q: "rome", order: "oldest" },
    labels,
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
const readout = (c: HTMLElement) => c.querySelector(".vf-history-readout-now")?.textContent;

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

describe("the slider held in view", () => {
  const docked = () => document.querySelector(".vf-history-docked");
  const box = () => document.querySelector(".vf-history-when")!;

  // jsdom lays nothing out, so the window is what these tests set it to.
  function roomFor(boxHeight: number) {
    vi.spyOn(box(), "getBoundingClientRect").mockReturnValue({ height: boxHeight } as DOMRect);
  }

  it("stays where it is in the page until it is used", () => {
    renderSlider();
    expect(box()).toHaveAccessibleName("Go to a year");
    expect(docked()).toBeNull();
  });

  it("is held from the moment it has the focus, by key or by press", () => {
    renderSlider();
    fireEvent.focus(slider());
    expect(docked()).not.toBeNull();
    cleanup();

    renderSlider();
    fireEvent.pointerDown(slider());
    expect(docked()).not.toBeNull();
    fireEvent.pointerUp(window);
    expect(docked()).not.toBeNull();
    cleanup();

    renderSlider();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(docked()).not.toBeNull();
  });

  it("is held when VoiceOver's swipe moves it with no focus at all", () => {
    renderSlider();
    fireEvent.change(slider(), { target: { value: "1100" } });
    expect(docked()).not.toBeNull();
  });

  // Something on the page past the box.
  function elsewhere() {
    const other = document.createElement("button");
    other.textContent = "elsewhere";
    document.body.append(other);
    onTestFinished(() => other.remove());
    return other;
  }

  it("is let go when the focus moves on, and not when it moves within", () => {
    renderSlider();
    fireEvent.focus(slider());
    fireEvent.focusIn(screen.getByRole("spinbutton"));
    expect(docked()).not.toBeNull();
    // Nothing took the focus: another window, or a click on the page's text.
    fireEvent.blur(slider(), { relatedTarget: null });
    expect(docked()).not.toBeNull();
    fireEvent.focusIn(elsewhere());
    expect(docked()).toBeNull();
  });

  it("is let go on a press anywhere else, and not on one of its own", () => {
    renderSlider();
    fireEvent.focus(slider());
    fireEvent.pointerDown(screen.getByRole("spinbutton"));
    expect(docked()).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(docked()).toBeNull();
  });

  // A swipe never puts the focus on the slider, so no blur ever comes. The next landing
  // would go underneath a box still held, with nothing on screen to show for it.
  it("is let go after a swipe when the focus lands anywhere else", () => {
    renderSlider();
    fireEvent.change(slider(), { target: { value: "1100" } });
    expect(docked()).not.toBeNull();
    fireEvent.focusIn(elsewhere());
    expect(docked()).toBeNull();
  });

  // Safari ends a drag let go off the box with a click on whatever holds both of its
  // ends, and a press there can move the focus to something around the box as well.
  it("stays held when a drag let go off the box ends in a click around it", () => {
    renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.pointerUp(window);
    expect(docked()).not.toBeNull();
    fireEvent.click(document.documentElement);
    expect(docked()).not.toBeNull();
    fireEvent.click(document.body);
    expect(docked()).not.toBeNull();
    fireEvent.focusIn(document.body);
    expect(docked()).not.toBeNull();
    // A press on the bare page is the reader going elsewhere, though.
    fireEvent.pointerDown(document.body);
    expect(docked()).toBeNull();
  });

  it("is let go after a swipe by a press that moves neither focus nor pointer", () => {
    render(
      <HistoryShell>
        <HistoryYearSlider
          min={33}
          max={2026}
          value={1000}
          valueEraLabel={null}
          eras={eras}
          keep={{}}
          labels={labels}
        />
        <details>
          <summary>A closed row</summary>
        </details>
        <a href="/history?page=2">A link</a>
      </HistoryShell>,
    );
    fireEvent.change(slider(), { target: { value: "1100" } });
    fireEvent.click(slider());
    expect(docked()).not.toBeNull();
    fireEvent.click(screen.getByText("A closed row"));
    expect(docked()).toBeNull();

    // The shell stops a link's click on its way down, and this still hears it.
    fireEvent.change(slider(), { target: { value: "1200" } });
    expect(docked()).not.toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "A link" }));
    expect(docked()).toBeNull();
    expect(push).toHaveBeenCalledWith("/history?page=2", { scroll: false });
  });

  it("is let go when the browser takes the touch for a scroll of the page", () => {
    renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.pointerCancel(window);
    expect(docked()).toBeNull();
  });

  it("is not held where it would take most of the window: enlarged text on a phone", () => {
    renderSlider();
    roomFor(window.innerHeight * 0.61);
    fireEvent.focus(slider());
    expect(docked()).toBeNull();
    roomFor(window.innerHeight * 0.59);
    fireEvent.focus(slider());
    expect(docked()).not.toBeNull();
  });

  // The box grew with a long era's name, or a phone's toolbars came back. The next key
  // used to drop the dock, and the slider, with the focus on it, went off the screen.
  it("stays held whatever room the window has left, once it is held", () => {
    renderSlider();
    roomFor(window.innerHeight * 0.59);
    fireEvent.focus(slider());
    expect(docked()).not.toBeNull();
    roomFor(window.innerHeight * 0.7);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(docked()).not.toBeNull();
    fireEvent.change(slider(), { target: { value: "1100" } });
    expect(docked()).not.toBeNull();
    fireEvent.pointerDown(slider());
    expect(docked()).not.toBeNull();
    fireEvent.pointerUp(window);
    fireEvent.focus(slider());
    expect(docked()).not.toBeNull();
  });

  it("keeps room for the longest era's name, whichever it is showing", () => {
    const { container } = renderSlider();
    const room = [...container.querySelectorAll(".vf-history-readout-room")];
    expect(room.map((r) => r.textContent)).toEqual(eras.map((e) => `2026, ${e.label}`));
    expect(container.querySelector(".vf-history-readout")).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves the page alone on a key once it is held, and brings itself back if it is not", () => {
    renderSlider();
    fireEvent.focus(slider());
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    cleanup();

    renderSlider();
    roomFor(window.innerHeight);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("stays where it is on the screen when the panel above it changes height", () => {
    window.scrollBy = vi.fn();
    const { all, rerender } = renderSlider();
    const at = (top: number) =>
      vi.spyOn(box(), "getBoundingClientRect").mockReturnValue({ top, height: 900 } as DOMRect);
    const showing = (value: number) =>
      rerender(
        <HistoryShell>
          <HistoryYearSlider {...all} value={value} />
        </HistoryShell>,
      );
    // It could not be held: the box takes more than the window allows.
    at(100);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(docked()).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(push).toHaveBeenCalledTimes(1);
    // A longer era's name above it carries it down, until the page goes with it.
    at(143);
    showing(1005);
    expect(window.scrollBy).toHaveBeenCalledWith(0, 43);
    // Another view with no move of its own, such as Back, is left to the browser.
    vi.mocked(window.scrollBy).mockClear();
    at(200);
    showing(33);
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("leaves a reader where they scrolled to while the view was on its way", () => {
    window.scrollBy = vi.fn();
    const { all, rerender } = renderSlider();
    vi.spyOn(box(), "getBoundingClientRect").mockReturnValue({ top: 100, height: 900 } as DOMRect);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    act(() => vi.advanceTimersByTime(1000));
    expect(push).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 300 });
    onTestFinished(() => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    });
    // The page went up 300 under the reader's own hand, and the box with it.
    vi.spyOn(box(), "getBoundingClientRect").mockReturnValue({ top: -200, height: 900 } as DOMRect);
    rerender(
      <HistoryShell>
        <HistoryYearSlider {...all} value={1005} />
      </HistoryShell>,
    );
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("leaves that to the sticky box when it is held", () => {
    window.scrollBy = vi.fn();
    const { all, rerender } = renderSlider();
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(docked()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    vi.spyOn(box(), "getBoundingClientRect").mockReturnValue({ top: 500 } as DOMRect);
    rerender(
      <HistoryShell>
        <HistoryYearSlider {...all} value={1005} />
      </HistoryShell>,
    );
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("takes the focus when pressed and let go, which Safari would not give it", () => {
    renderSlider();
    fireEvent.pointerDown(slider());
    fireEvent.change(slider(), { target: { value: "1200" } });
    fireEvent.pointerUp(window);
    expect(document.activeElement).toBe(slider());
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(slider());
    expect(document.activeElement).toBe(slider());
  });
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

  it("goes on with Enter to the row it stands on, and says so in its hint", () => {
    render(
      <HistoryShell>
        <HistoryYearSlider
          min={33}
          max={2026}
          value={1054}
          valueEraLabel={null}
          eras={eras}
          keep={{}}
          labels={labels}
        />
        <details>
          <summary className="vf-timeline-summary vf-timeline-current">The Great Schism</summary>
        </details>
      </HistoryShell>,
    );
    slider().focus();
    fireEvent.keyDown(slider(), { key: "Enter" });
    expect(document.activeElement).toBe(document.querySelector(".vf-timeline-current"));
    expect(push).not.toHaveBeenCalled();
    expect(slider()).toHaveAccessibleDescription(/press Enter to go on to its event/);
  });

  it("goes on with Enter to the first row when none is marked", () => {
    render(
      <HistoryShell>
        <HistoryYearSlider
          min={33}
          max={2026}
          value={33}
          valueEraLabel={null}
          eras={eras}
          keep={{}}
          labels={labels}
        />
        <details>
          <summary className="vf-timeline-summary">Pentecost</summary>
        </details>
      </HistoryShell>,
    );
    fireEvent.keyDown(slider(), { key: "Enter" });
    expect(document.activeElement).toBe(document.querySelector(".vf-timeline-summary"));
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
