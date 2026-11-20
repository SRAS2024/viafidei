/**
 * @vitest-environment jsdom
 *
 * The pray-along speed is remembered in the browser, and a signed-in member's is kept in
 * their account so it is the same on every browser they sign in on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_SAVE_DELAY_MS,
  adoptAccountRate,
  cycleRate,
  getRate,
  RATE_STORAGE_KEY,
  rateChanges,
  resetRateForTests,
  subscribeRate,
} from "@/components/pray-along/rate-store";

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  resetRateForTests();
  window.localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const savedBodies = () =>
  fetchMock.mock.calls.map((call) => {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PATCH");
    expect(init.keepalive).toBe(true);
    return JSON.parse(String(init.body)) as unknown;
  });

describe("the pray-along speed", () => {
  it("starts at 1x, or at the last speed this browser chose", () => {
    expect(getRate()).toBe(1);
    resetRateForTests();
    window.localStorage.setItem(RATE_STORAGE_KEY, "1.5");
    expect(getRate()).toBe(1.5);
  });

  it("ignores a stored value that is not one of the speeds", () => {
    window.localStorage.setItem(RATE_STORAGE_KEY, "3");
    expect(getRate()).toBe(1);
  });

  it("steps 1x → 1.25x → 1.5x → 1x, remembering each in the browser", () => {
    const heard: number[] = [];
    subscribeRate((r) => heard.push(r));
    expect([cycleRate(), cycleRate(), cycleRate()]).toEqual([1.25, 1.5, 1]);
    expect(heard).toEqual([1.25, 1.5, 1]);
    expect(window.localStorage.getItem(RATE_STORAGE_KEY)).toBe("1");
    cycleRate();
    expect(window.localStorage.getItem(RATE_STORAGE_KEY)).toBe("1.25");
  });

  it("saves nothing to an account for a visitor who is not signed in", () => {
    adoptAccountRate({ member: false, rate: null }, rateChanges());
    cycleRate();
    vi.advanceTimersByTime(ACCOUNT_SAVE_DELAY_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes a member's saved speed on any browser, and this browser remembers it", () => {
    window.localStorage.setItem(RATE_STORAGE_KEY, "1.25");
    const heard: number[] = [];
    subscribeRate((r) => heard.push(r));
    adoptAccountRate({ member: true, rate: 1.5 }, rateChanges());
    expect(getRate()).toBe(1.5);
    expect(heard).toEqual([1.5]);
    expect(window.localStorage.getItem(RATE_STORAGE_KEY)).toBe("1.5");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps this browser's speed for a member whose account has none yet", () => {
    window.localStorage.setItem(RATE_STORAGE_KEY, "1.25");
    adoptAccountRate({ member: true, rate: null }, rateChanges());
    expect(getRate()).toBe(1.25);
  });

  it("saves a member's choice to their account once, a moment after the last click", () => {
    adoptAccountRate({ member: true, rate: 1 }, rateChanges());
    cycleRate();
    cycleRate();
    vi.advanceTimersByTime(ACCOUNT_SAVE_DELAY_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    cycleRate();
    vi.advanceTimersByTime(ACCOUNT_SAVE_DELAY_MS);
    expect(savedBodies()).toEqual([{ audioRate: 1 }]);
  });

  it("keeps a change made while the playlist was loading, and saves it for a member", () => {
    const atRequest = rateChanges();
    cycleRate(); // 1.25, chosen before the playlist arrived
    adoptAccountRate({ member: true, rate: 1.5 }, atRequest);
    expect(getRate()).toBe(1.25);
    vi.advanceTimersByTime(ACCOUNT_SAVE_DELAY_MS);
    expect(savedBodies()).toEqual([{ audioRate: 1.25 }]);
  });

  it("still steps through the speeds when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getRate()).toBe(1);
    expect(cycleRate()).toBe(1.25);
    expect(getRate()).toBe(1.25);
  });
});
