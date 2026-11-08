/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRouterTransitionStart } from "@/instrumentation-client";
import { NAVIGATION_PATIENCE_MS, watchNavigation } from "@/lib/navigation/watch-navigation";

const START = "https://etviafidei.com/saints";

describe("watchNavigation", () => {
  let fake: {
    href: string;
    origin: string;
    assign: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    fake = { href: START, origin: "https://etviafidei.com", assign: vi.fn(), replace: vi.fn() };
    vi.stubGlobal("location", fake);
  });

  afterEach(() => {
    // Leaves no watch armed for the next test.
    window.dispatchEvent(new Event("pagehide"));
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is armed by what Next calls as each navigation starts", () => {
    onRouterTransitionStart("/saints?page=2", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).toHaveBeenCalledWith("https://etviafidei.com/saints?page=2");
  });

  it("loads the page outright when a push never moves the address", () => {
    watchNavigation("/saints?page=2", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS - 1);
    expect(fake.assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fake.assign).toHaveBeenCalledWith("https://etviafidei.com/saints?page=2");
    expect(fake.replace).not.toHaveBeenCalled();
  });

  it("keeps a lost replace a replace, so Back still leaves the page", () => {
    watchNavigation("/liturgy/readings?date=2026-11-06", "replace");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.replace).toHaveBeenCalledWith(
      "https://etviafidei.com/liturgy/readings?date=2026-11-06",
    );
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("does nothing once the address has moved", () => {
    watchNavigation("/saints?page=2", "push");
    fake.href = "https://etviafidei.com/saints?page=2";
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("counts a redirect that lands somewhere else as landed", () => {
    watchNavigation("/spiritual-guidance", "push");
    fake.href = "https://etviafidei.com/our-lady";
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("leaves a link to the page already showing alone", () => {
    watchNavigation("/saints", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("leaves another site alone", () => {
    watchNavigation("https://www.vatican.va/", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("watches only the newest navigation", () => {
    watchNavigation("/saints?page=2", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS - 1);
    watchNavigation("/saints?page=3", "push");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS - 1);
    expect(fake.assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fake.assign).toHaveBeenCalledTimes(1);
    expect(fake.assign).toHaveBeenCalledWith("https://etviafidei.com/saints?page=3");
  });

  it("stands down for back and forward", () => {
    watchNavigation("/saints?page=2", "push");
    watchNavigation("https://etviafidei.com/prayers", "traverse");
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("does not finish a navigation on a page the reader has left", () => {
    watchNavigation("/saints?page=2", "push");
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });

  it("stands down when the reader goes Back to an entry the router never reports", () => {
    // The navigation lands, then Back returns the address to where it started, onto an
    // entry Next ignores. The old timer must not take the reader forward again.
    watchNavigation("/prayers", "push");
    fake.href = "https://etviafidei.com/prayers";
    vi.advanceTimersByTime(1000);
    fake.href = START;
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    vi.advanceTimersByTime(NAVIGATION_PATIENCE_MS);
    expect(fake.assign).not.toHaveBeenCalled();
  });
});
