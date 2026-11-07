/**
 * @vitest-environment jsdom
 */
/**
 * The date under "Today's Feast Day Saints" is always the date of the list below
 * it. A link from the homepage names the reader's own day; a plain visit is
 * rendered on the server's clock, whose day can differ from the reader's by the
 * evening, and asks for the reader's day rather than label one day's saints with
 * another's date. It goes on asking in a tab left open overnight, and does not leave
 * getting there to one client navigation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { TodayDateLabel } from "@/app/saints/today/TodayDateLabel";

/** The address bar, which the label reads and, as a last resort, replaces. */
function stubLocation(search = "", pathname = "/saints/today") {
  const location = { pathname, search, replace: vi.fn() };
  vi.stubGlobal("location", location);
  return location;
}

beforeEach(() => {
  replace.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState({}, "");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 7, 20, 30));
  stubLocation();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TodayDateLabel", () => {
  it("adds the year when the list's date is today on the reader's device", () => {
    stubLocation("?month=11&day=7");
    render(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
    expect(screen.getByText("November 7, 2026")).toHaveClass("vf-page-hero-lede");
    expect(replace).not.toHaveBeenCalled();
  });

  it("names the date in the URL, not today, when the two differ", () => {
    stubLocation("?month=12&day=25");
    render(<TodayDateLabel serverMonth={12} serverDay={25} dateFromUrl />);
    expect(screen.getByText("December 25")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks for the reader's day when a plain visit got the server's", () => {
    // Evening in the Americas: the server's clock has already reached tomorrow.
    render(<TodayDateLabel serverMonth={11} serverDay={8} />);
    expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=7", { scroll: false });
    // Until the reader's list arrives, the label still describes the list shown.
    expect(screen.getByText("November 8")).toBeInTheDocument();
  });

  it("leaves a plain visit alone when the two clocks agree", () => {
    render(<TodayDateLabel serverMonth={11} serverDay={7} />);
    expect(screen.getByText("November 7, 2026")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  describe("a lost correction", () => {
    it("loads the page at the right address when the router never commits", () => {
      const location = stubLocation();
      render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      expect(replace).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(location.replace).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(location.replace).toHaveBeenCalledWith("/saints/today?month=11&day=7");
      expect(location.replace).toHaveBeenCalledTimes(1);
    });

    it("does not load it again when the router has got there", () => {
      const location = stubLocation();
      render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      // The router commits a beat late: the address has changed, the page has not yet.
      location.search = "?month=11&day=7";
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(location.replace).not.toHaveBeenCalled();
    });

    it("stands down once the page it asked for has rendered", () => {
      const location = stubLocation();
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      location.search = "?month=11&day=7";
      rerender(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
      expect(screen.getByText("November 7, 2026")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(location.replace).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledTimes(1);
    });

    it("does not pull the visitor back from a page they have left for", () => {
      const location = stubLocation();
      const { unmount } = render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      unmount();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(location.replace).not.toHaveBeenCalled();
    });

    it("forgets what it asked for when the visitor leaves before it arrives", () => {
      const location = stubLocation();
      const { unmount } = render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      expect(window.sessionStorage.getItem("vf_saints_today_asked")).toBe(
        "/saints/today?month=11&day=7",
      );
      location.pathname = "/saints";
      location.search = "";
      unmount();
      expect(window.sessionStorage.getItem("vf_saints_today_asked")).toBeNull();
    });

    it.each(["click", "submit"])("puts the load off after a %s", (kind) => {
      const location = stubLocation();
      render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      act(() => {
        vi.advanceTimersByTime(1000);
        document.body.dispatchEvent(new Event(kind, { bubbles: true }));
        vi.advanceTimersByTime(29_999);
      });
      expect(location.replace).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(location.replace).toHaveBeenCalledWith("/saints/today?month=11&day=7");
    });

    it("never reloads for ever, on a device whose day the page cannot show", () => {
      // The address already says the reader's day, and the list is not that day's.
      const location = stubLocation("?month=11&day=7");
      window.history.replaceState({ vfFollowsToday: true }, "");
      render(<TodayDateLabel serverMonth={11} serverDay={8} dateFromUrl />);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(replace).not.toHaveBeenCalled();
      expect(location.replace).not.toHaveBeenCalled();
    });
  });

  describe("a tab left open", () => {
    const passMidnight = () =>
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 7, 23, 59, 59));
        vi.advanceTimersByTime(60 * 60_000);
      });

    it("moves a plain visit on at the reader's midnight", () => {
      vi.setSystemTime(new Date(2026, 10, 7, 23, 59, 50));
      render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      expect(screen.getByText("November 7, 2026")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=8", { scroll: false });
      // Until the new day's list arrives, the label is true of the list still shown.
      expect(screen.getByText("November 7")).toBeInTheDocument();
    });

    it("moves it on when the reader comes back the next morning", () => {
      render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      expect(replace).not.toHaveBeenCalled();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
        window.dispatchEvent(new Event("focus"));
      });
      expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=8", { scroll: false });
    });

    it("goes on following the day once its own correction has named a date", () => {
      const location = stubLocation();
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={8} />);
      expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=7", { scroll: false });

      // The router commits, and its own state replaces whatever the entry held.
      location.search = "?month=11&day=7";
      window.history.replaceState({ fromRouter: true }, "");
      rerender(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
      expect(window.history.state).toEqual({ fromRouter: true, vfFollowsToday: true });
      expect(window.sessionStorage.getItem("vf_saints_today_asked")).toBeNull();

      replace.mockClear();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
        window.dispatchEvent(new Event("focus"));
      });
      expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=8", { scroll: false });
    });

    it("never rewrites a date named in the URL, however long it stays open", () => {
      const location = stubLocation("?month=11&day=7");
      render(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
      expect(screen.getByText("November 7, 2026")).toBeInTheDocument();

      passMidnight();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 9, 9, 0));
        window.dispatchEvent(new Event("focus"));
        vi.advanceTimersByTime(60_000);
      });
      expect(replace).not.toHaveBeenCalled();
      expect(location.replace).not.toHaveBeenCalled();
      // It is still that date's list, and that date is no longer today.
      expect(screen.getByText("November 7")).toBeInTheDocument();
    });

    it("does not take a link to the same date for its own correction", () => {
      // A correction asked for and overtaken in another page leaves nothing behind it.
      stubLocation("?month=11&day=7");
      render(<TodayDateLabel serverMonth={11} serverDay={7} dateFromUrl />);
      expect(window.history.state?.vfFollowsToday).toBeUndefined();
    });
  });

  describe("a reader part-way down the list when the day moves", () => {
    // The list is replaced whole. WebKit puts the page back at the top as it is, whatever
    // the router was told, and a focused card goes with the old list, in every engine.
    let y = 0;
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      y = options.top ?? y;
    });
    const list = (names: string[]) => {
      document.querySelector("main")?.remove();
      const main = document.createElement("main");
      for (const name of names) {
        const link = document.createElement("a");
        link.href = `/saints/${name}`;
        link.className = "vf-entry-link";
        link.textContent = name;
        main.append(link);
      }
      document.body.append(main);
      return [...main.querySelectorAll<HTMLElement>(".vf-entry-link")];
    };

    beforeEach(() => {
      y = 0;
      scrollTo.mockClear();
      Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
      vi.stubGlobal("scrollTo", scrollTo);
    });
    afterEach(() => {
      document.querySelector("main")?.remove();
    });

    it("keeps their place on the page and their place in the list", () => {
      const location = stubLocation();
      const cards = list(["a", "b", "c", "d", "e"]);
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      cards[4]!.focus();
      y = 212;
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 0, 0, 5));
        window.dispatchEvent(new Event("focus"));
      });
      expect(replace).toHaveBeenCalledWith("/saints/today?month=11&day=8", { scroll: false });

      // The router commits the new day's list, and WebKit has put the page at the top.
      const next = list(["f", "g", "h", "i", "j", "k"]);
      expect(document.activeElement).toBe(document.body);
      y = 0;
      location.search = "?month=11&day=8";
      rerender(<TodayDateLabel serverMonth={11} serverDay={8} dateFromUrl />);

      expect(scrollTo).toHaveBeenCalledWith({ top: 212, behavior: "instant" });
      expect(y).toBe(212);
      expect(document.activeElement).toBe(next[4]);
    });

    it("follows the reader if they move while the list is on its way", () => {
      const location = stubLocation();
      const cards = list(["a", "b", "c", "d", "e"]);
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 0, 0, 5));
        window.dispatchEvent(new Event("focus"));
      });
      cards[1]!.focus();
      y = 90;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });

      const next = list(["f", "g"]);
      y = 0;
      location.search = "?month=11&day=8";
      rerender(<TodayDateLabel serverMonth={11} serverDay={8} dateFromUrl />);
      expect(y).toBe(90);
      expect(document.activeElement).toBe(next[1]);
    });

    it("puts a shorter list's last card in focus when the reader was further down", () => {
      const location = stubLocation();
      const cards = list(["a", "b", "c", "d", "e"]);
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      cards[4]!.focus();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 0, 0, 5));
        window.dispatchEvent(new Event("focus"));
      });
      const next = list(["f", "g"]);
      location.search = "?month=11&day=8";
      rerender(<TodayDateLabel serverMonth={11} serverDay={8} dateFromUrl />);
      expect(document.activeElement).toBe(next[1]);
    });

    it("leaves focus alone when it was not on a card", () => {
      const location = stubLocation();
      list(["a", "b", "c"]);
      const { rerender } = render(<TodayDateLabel serverMonth={11} serverDay={7} />);
      const search = document.createElement("input");
      document.body.append(search);
      search.focus();
      act(() => {
        vi.setSystemTime(new Date(2026, 10, 8, 0, 0, 5));
        window.dispatchEvent(new Event("focus"));
      });
      list(["f", "g", "h"]);
      location.search = "?month=11&day=8";
      rerender(<TodayDateLabel serverMonth={11} serverDay={8} dateFromUrl />);
      expect(document.activeElement).toBe(search);
      search.remove();
    });
  });
});
