/**
 * @vitest-environment jsdom
 *
 * The readings page's "today": the visitor's own date, and on that day, from noon on
 * their device, the evening's Mass when the address chose none. Every other date, and
 * any Mass the address names, is left as it is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { TodayDateSync } from "@/app/liturgy/readings/TodayDateSync";

const SATURDAY = "2026-11-07";
const EVENING = `/liturgy/readings?date=${SATURDAY}&mass=vigil`;

/** The device's clock, every timer left running. */
function deviceClock(hour: number, day = 7) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, day, hour, 0));
}

function at(address: string, state: Record<string, unknown> | null = null) {
  window.history.replaceState(state, "", address);
}

beforeEach(() => {
  replace.mockClear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TodayDateSync — the evening's Mass from noon", () => {
  it("leaves the day's own Mass in the morning", () => {
    deviceClock(11);
    at("/liturgy/readings");
    render(<TodayDateSync renderedDate={SATURDAY} enabled eveningHref={EVENING} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens on the evening's Mass from noon when today was asked for", () => {
    deviceClock(12);
    at("/liturgy/readings");
    render(<TodayDateSync renderedDate={SATURDAY} enabled eveningHref={EVENING} />);
    expect(replace).toHaveBeenCalledWith(EVENING);
  });

  it("and when today's date was named without a Mass, as the homepage names it", () => {
    deviceClock(17);
    at(`/liturgy/readings?date=${SATURDAY}`);
    render(<TodayDateSync renderedDate={SATURDAY} enabled={false} eveningHref={EVENING} />);
    expect(replace).toHaveBeenCalledWith(EVENING);
  });

  it("never overrules a Mass the address chose", () => {
    deviceClock(17);
    at(`/liturgy/readings?date=${SATURDAY}&mass=day`);
    render(
      <TodayDateSync renderedDate={SATURDAY} enabled={false} eveningHref={EVENING} massChosen />,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves another Saturday on its own Mass", () => {
    deviceClock(17);
    at("/liturgy/readings?date=2026-11-14");
    render(
      <TodayDateSync
        renderedDate="2026-11-14"
        enabled={false}
        eveningHref="/liturgy/readings?date=2026-11-14&mass=vigil"
      />,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("has nothing to do on a date without an evening Mass", () => {
    deviceClock(17, 5);
    at("/liturgy/readings?date=2026-11-05");
    render(<TodayDateSync renderedDate="2026-11-05" enabled={false} eveningHref={null} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("marks the entry it arrives at, so the choice is known for the clock's", () => {
    deviceClock(17);
    window.sessionStorage.setItem(
      "vf_readings_today_asked",
      JSON.stringify({ to: EVENING, today: true, clock: true }),
    );
    at(EVENING);
    render(<TodayDateSync renderedDate={SATURDAY} enabled={false} massChosen />);
    expect(window.history.state).toMatchObject({ vfFollowsToday: true, vfMassByClock: true });
    expect(window.sessionStorage.getItem("vf_readings_today_asked")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("drops the clock's evening Mass when the tab moves on to a new day", () => {
    deviceClock(9, 8);
    at(EVENING, { vfFollowsToday: true, vfMassByClock: true });
    render(<TodayDateSync renderedDate={SATURDAY} enabled={false} massChosen />);
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-11-08");
  });

  it("but keeps an evening Mass the visitor chose", () => {
    deviceClock(9, 8);
    at(EVENING, { vfFollowsToday: true });
    render(<TodayDateSync renderedDate={SATURDAY} enabled={false} massChosen />);
    expect(replace).toHaveBeenCalledWith("/liturgy/readings?date=2026-11-08&mass=vigil");
  });

  it("still reads an address kept before the clock had a say", () => {
    deviceClock(9, 8);
    window.sessionStorage.setItem("vf_readings_today_asked", "/liturgy/readings?date=2026-11-08");
    at("/liturgy/readings?date=2026-11-08");
    render(<TodayDateSync renderedDate="2026-11-08" enabled={false} />);
    expect(window.history.state).toMatchObject({ vfFollowsToday: true });
    expect(window.history.state?.vfMassByClock).toBeUndefined();
  });
});
