/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRouterTransitionStart } from "@/instrumentation-client";
import {
  notePendingNavigation,
  PENDING_SPOKEN_AFTER_MS,
  subscribePendingNavigation,
} from "@/lib/navigation/pending-navigation";
import { NAVIGATION_PATIENCE_MS } from "@/lib/navigation/watch-navigation";

const START = "https://etviafidei.com/";

describe("notePendingNavigation", () => {
  let fake: { href: string; origin: string; assign: ReturnType<typeof vi.fn>; replace: () => void };
  let said: boolean[];
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    fake = { href: START, origin: "https://etviafidei.com", assign: vi.fn(), replace: vi.fn() };
    vi.stubGlobal("location", fake);
    said = [];
    unsubscribe = subscribePendingNavigation((pending) => said.push(pending));
    // Subscribing reports the state there is: nothing waiting.
    said.length = 0;
  });

  afterEach(() => {
    // Leaves no wait or safety net armed for the next test.
    window.dispatchEvent(new Event("pagehide"));
    unsubscribe();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("says nothing for a navigation that lands quickly", () => {
    notePendingNavigation("/liturgy/readings?date=2026-11-07", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS - 100);
    fake.href = "https://etviafidei.com/liturgy/readings?date=2026-11-07";
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS * 10);
    expect(said).toEqual([]);
  });

  it("says it is loading once the address has stood still for a moment, and clears on arrival", () => {
    notePendingNavigation("/liturgy/readings?date=2026-11-07", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS - 1);
    expect(said).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(said).toEqual([true]);
    vi.advanceTimersByTime(3000);
    expect(said).toEqual([true]);
    fake.href = "https://etviafidei.com/liturgy/readings?date=2026-11-07";
    vi.advanceTimersByTime(100);
    expect(said).toEqual([true, false]);
  });

  it("does not say it twice for a second navigation in the same wait", () => {
    notePendingNavigation("/history", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS + 200);
    notePendingNavigation("/saints/today?month=11&day=7", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS * 4);
    expect(said).toEqual([true]);
    fake.href = "https://etviafidei.com/saints/today?month=11&day=7";
    vi.advanceTimersByTime(100);
    expect(said).toEqual([true, false]);
  });

  it("times a second navigation from its own start when the first was not yet said", () => {
    notePendingNavigation("/history", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS - 100);
    notePendingNavigation("/saints/today?month=11&day=7", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS - 1);
    expect(said).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(said).toEqual([true]);
  });

  it("starts afresh after a page that landed in the moment before", () => {
    notePendingNavigation("/history", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS + 10);
    // Landed, and the next navigation begins before the arrival is noticed.
    fake.href = "https://etviafidei.com/history";
    notePendingNavigation("/history?theme=councils", "push");
    expect(said).toEqual([true, false]);
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS);
    expect(said).toEqual([true, false, true]);
  });

  it("stops for Back and Forward", () => {
    notePendingNavigation("/history", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS + 10);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(said).toEqual([true, false]);
    notePendingNavigation("/saints", "push");
    notePendingNavigation("https://etviafidei.com/prayers", "traverse");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS * 4);
    expect(said).toEqual([true, false]);
  });

  it("says nothing for the page already showing or another site", () => {
    notePendingNavigation("/", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS * 4);
    notePendingNavigation("https://www.vatican.va/", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS * 4);
    expect(said).toEqual([]);
  });

  it("is started by Next's navigation hook, together with the safety net", () => {
    onRouterTransitionStart("/history", "push");
    vi.advanceTimersByTime(PENDING_SPOKEN_AFTER_MS);
    expect(said).toEqual([true]);
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS - PENDING_SPOKEN_AFTER_MS);
    expect(fake.assign).toHaveBeenCalledWith("https://etviafidei.com/history");
  });
});
