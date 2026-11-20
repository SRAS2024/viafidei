/**
 * @vitest-environment jsdom
 *
 * The megaphone, for a VoiceOver user: a labelled button that says what it will do,
 * a Stop button while a prayer is under way, every change said in a status region,
 * and focus never dropped.
 */
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

type State = { status: string; targetId: string | null };

const player = vi.hoisted(() => {
  let state: State = { status: "idle", targetId: null };
  const listeners = new Set<(s: State) => void>();
  return {
    set(next: State) {
      state = next;
      for (const l of listeners) l(state);
    },
    reset() {
      state = { status: "idle", targetId: null };
      listeners.clear();
    },
    getPlayerState: () => state,
    subscribePlayer: (l: (s: State) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    startPrayAlong: vi.fn(),
    pausePrayAlong: vi.fn(),
    resumePrayAlong: vi.fn(),
    stopPrayAlong: vi.fn(),
    registerPrayAlongButton: vi.fn(() => () => undefined),
    targetIdOf: (t: { kind: string; slug?: string; day?: number; set?: string }) =>
      [t.kind, t.slug ?? "", t.day ?? "", t.set ?? ""].join(":"),
  };
});

vi.mock("@/components/pray-along/player", () => player);
vi.mock("@/components/ui/PrayerLanguageChips", () => ({
  usePrayerLanguage: () => ({ language: "la", toggle: vi.fn() }),
}));

import {
  PrayAlongButton,
  PrayAlongLabelsProvider,
  type PrayAlongLabels,
} from "@/components/pray-along/PrayAlongButton";
import { RATE_STORAGE_KEY, resetRateForTests } from "@/components/pray-along/rate-store";

const TARGET = { kind: "prayer" as const, slug: "hail-mary" };
const ID = "prayer:hail-mary::";

beforeEach(() => {
  player.reset();
  resetRateForTests();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PrayAlongButton", () => {
  it("is a labelled button that starts nothing until pressed", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    const button = screen.getByRole("button", { name: "Pray along: Hail Mary" });
    expect(button).not.toHaveAttribute("disabled");
    expect(player.startPrayAlong).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("starts the prayer in the language the reader chose (Latin here)", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    fireEvent.click(screen.getByRole("button", { name: "Pray along: Hail Mary" }));
    expect(player.startPrayAlong).toHaveBeenCalledWith(TARGET, {
      chosen: "la",
      title: "Hail Mary",
    });
  });

  it("names pause, resume and stop while praying, and says each change", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    act(() => player.set({ status: "loading", targetId: ID }));
    expect(screen.getByRole("status")).toHaveTextContent("Preparing the audio…");
    act(() => player.set({ status: "playing", targetId: ID }));
    expect(
      screen.getByRole("button", { name: "Pause praying along: Hail Mary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop praying along: Hail Mary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Praying along.");
    fireEvent.click(screen.getByRole("button", { name: "Pause praying along: Hail Mary" }));
    expect(player.pausePrayAlong).toHaveBeenCalled();
    act(() => player.set({ status: "paused", targetId: ID }));
    expect(screen.getByRole("status")).toHaveTextContent("Paused.");
    fireEvent.click(screen.getByRole("button", { name: "Resume praying along: Hail Mary" }));
    expect(player.resumePrayAlong).toHaveBeenCalled();
    act(() => player.set({ status: "finished", targetId: ID }));
    expect(screen.getByRole("status")).toHaveTextContent("Finished.");
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("puts focus back on the megaphone when Stop is pressed and disappears", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    act(() => player.set({ status: "playing", targetId: ID }));
    const stop = screen.getByRole("button", { name: "Stop praying along: Hail Mary" });
    stop.focus();
    fireEvent.click(stop);
    expect(player.stopPrayAlong).toHaveBeenCalled();
    act(() => player.set({ status: "stopped", targetId: ID }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Pray along: Hail Mary" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Stopped.");
  });

  it("stays quiet when another prayer on the page is the one playing", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    act(() => player.set({ status: "playing", targetId: "prayer:our-father::" }));
    expect(screen.getByRole("button", { name: "Pray along: Hail Mary" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("draws its level meter only while praying, hidden from screen readers", () => {
    const { container } = render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    expect(container.querySelector(".vf-pray-along-level")).toBeNull();
    act(() => player.set({ status: "playing", targetId: ID }));
    expect(container.querySelector(".vf-pray-along-level")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the speed right of Stop while praying, steps through the speeds and says each", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    expect(screen.queryByRole("button", { name: /^Speed/ })).toBeNull();
    act(() => player.set({ status: "playing", targetId: ID }));
    const stop = screen.getByRole("button", { name: "Stop praying along: Hail Mary" });
    const speed = screen.getByRole("button", { name: "Speed 1x" });
    expect(speed).toHaveTextContent("1x");
    expect(stop.nextElementSibling).toBe(speed);
    fireEvent.click(speed);
    expect(screen.getByRole("button", { name: "Speed 1.25x" })).toHaveTextContent("1.25x");
    expect(screen.getByRole("status")).toHaveTextContent("Speed 1.25x");
    fireEvent.click(screen.getByRole("button", { name: "Speed 1.25x" }));
    expect(screen.getByRole("status")).toHaveTextContent("Speed 1.5x");
    fireEvent.click(screen.getByRole("button", { name: "Speed 1.5x" }));
    expect(screen.getByRole("status")).toHaveTextContent("Speed 1x");
    expect(window.localStorage.getItem(RATE_STORAGE_KEY)).toBe("1");
    // The next change of state is said in its place; paused, the speed can still change.
    act(() => player.set({ status: "paused", targetId: ID }));
    expect(screen.getByRole("status")).toHaveTextContent("Paused.");
    expect(screen.getByRole("button", { name: "Speed 1x" })).toBeInTheDocument();
    act(() => player.set({ status: "finished", targetId: ID }));
    expect(screen.queryByRole("button", { name: /^Speed/ })).toBeNull();
  });

  it("opens at the speed this browser last chose", () => {
    window.localStorage.setItem(RATE_STORAGE_KEY, "1.5");
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    act(() => player.set({ status: "playing", targetId: ID }));
    expect(screen.getByRole("button", { name: "Speed 1.5x" })).toHaveTextContent("1.5x");
  });

  it("writes the speed in the reader's language, with its decimal mark", () => {
    const french: PrayAlongLabels = {
      play: "Prier avec : {title}",
      pause: "Mettre en pause : {title}",
      resume: "Reprendre : {title}",
      stop: "Arrêter la prière : {title}",
      preparing: "Préparation de l'audio pour {title}",
      loading: "Préparation de l'audio…",
      playing: "Prière en cours.",
      paused: "En pause.",
      waiting: "La suite est en préparation…",
      stopped: "Arrêtée.",
      finished: "Terminée.",
      unavailable: "Pas encore prête.",
      error: "Lecture impossible.",
      speed: "Vitesse {rate}",
      locale: "fr",
    };
    render(
      <PrayAlongLabelsProvider labels={french}>
        <PrayAlongButton target={TARGET} title="Je vous salue Marie" />
      </PrayAlongLabelsProvider>,
    );
    act(() => player.set({ status: "playing", targetId: ID }));
    fireEvent.click(screen.getByRole("button", { name: "Vitesse 1x" }));
    expect(screen.getByRole("button", { name: "Vitesse 1,25x" })).toHaveTextContent("1,25x");
    expect(screen.getByRole("status")).toHaveTextContent("Vitesse 1,25x");
  });

  it("puts focus back on the megaphone when the speed button goes with the prayer", () => {
    render(<PrayAlongButton target={TARGET} title="Hail Mary" />);
    act(() => player.set({ status: "playing", targetId: ID }));
    screen.getByRole("button", { name: "Speed 1x" }).focus();
    act(() => player.set({ status: "finished", targetId: ID }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Pray along: Hail Mary" }),
    );
  });
});
