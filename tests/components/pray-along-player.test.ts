/**
 * @vitest-environment jsdom
 *
 * The player itself, with a stand-in for the browser's audio element: a line that can
 * never be said ends the prayer at once with that reason, never after a silent wait;
 * time paused is not time waited, so resuming after a long pause goes on praying; a
 * clip that will not load ends the prayer with a message, not a silence without end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Item =
  | { type: "clip"; url: string; ready: boolean; missing?: boolean }
  | { type: "pause"; ms: number };

/** What a browser rejects a play() with when a pause or a new file cuts it short. */
const abort = () => new DOMException("The play() request was interrupted.", "AbortError");

/** The one audio element the player makes; the test says when a file ends or fails. */
class FakeAudio {
  static last: FakeAudio | null = null;
  paused = true;
  ended = false;
  preload = "";
  preservesPitch = false;
  defaultPlaybackRate = 1;
  playbackRate = 1;
  /** Every file started, in order. */
  played: string[] = [];
  /** When true, a play() stays pending, as while its file loads, until start(). */
  hold = false;
  private current = "";
  private pending: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  private handlers = new Map<string, Array<() => void>>();
  constructor() {
    FakeAudio.last = this;
  }
  get src() {
    return this.current;
  }
  /** A new file cuts short a play() still starting, as in a browser. */
  set src(url: string) {
    this.cutShort();
    this.current = url;
  }
  addEventListener(type: string, fn: () => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
  play() {
    this.paused = false;
    this.ended = false;
    this.played.push(this.src);
    if (!this.hold) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }
  /**
   * A pause cuts short a play() still starting, as in a browser, and is announced with a
   * "pause" event when the element was playing (a browser queues it; here it is at once).
   */
  pause() {
    const was = this.paused;
    this.paused = true;
    this.cutShort();
    if (!was) this.fire("pause");
  }
  /** The device pauses the audio itself: a phone call, Siri, headphones taken out. */
  interrupt() {
    this.pause();
  }
  /** Has the file not loaded (a browser's MediaError), or null. */
  error: { code: number } | null = null;
  /** The pending play() has started. */
  start() {
    this.pending?.resolve();
    this.pending = null;
  }
  private cutShort() {
    this.pending?.reject(abort());
    this.pending = null;
  }
  /** The file now playing has played to its end: "pause", then "ended", as in a browser. */
  end() {
    this.ended = true;
    this.paused = true;
    this.fire("pause");
    this.fire("ended");
  }
  /** The file now playing would not load. */
  fail() {
    this.paused = true;
    this.error = { code: 4 };
    this.fire("error");
  }
  private fire(type: string) {
    for (const fn of this.handlers.get(type) ?? []) fn();
  }
}

const TARGET = { kind: "prayer" as const, slug: "memorare" };
const PRESS_SILENCE = "/audio/silence-300.m4a";
const WAIT_SILENCE = "/audio/silence-1100.m4a";
const T0 = new Date("2026-11-22T03:00:00.000Z").getTime();

/** What the playlist answers now (the test changes it as the engine would). */
let items: Item[];
let playlistAsks = 0;
let player: typeof import("@/components/pray-along/player");
let statuses: string[];

const audio = () => FakeAudio.last!;
const status = () => player.getPlayerState().status;
const clip = (url: string, ready = true): Item => ({ type: "clip", url, ready });

/** Lets the player's awaited fetches settle. */
async function settle() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Moves the clock on, as if `ms` went by. */
function later(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

/** Presses the megaphone and lets the press's short silence end. */
async function press() {
  await player.startPrayAlong(TARGET, { chosen: "la", title: "Memorare" });
  if (status() === "loading" && audio().src === PRESS_SILENCE) audio().end();
  await settle();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.resetModules();
  FakeAudio.last = null;
  playlistAsks = 0;
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (String(input).startsWith("/api/pray-along?")) {
        playlistAsks += 1;
        // A copy, as a fresh response would be: the player may mark its items.
        const body = { title: "Memorare", items: items.map((i) => ({ ...i })) };
        return { ok: true, status: 200, json: async () => body };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
  player = await import("@/components/pray-along/player");
  statuses = [];
  player.subscribePlayer((s) => statuses.push(s.status));
});

afterEach(() => {
  player.stopPrayAlong();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the pray-along player", () => {
  it("plays none of a prayer with a line that can never be said, and says why at once", async () => {
    items = [
      clip("/c/ave"),
      { type: "pause", ms: 700 },
      { ...clip("/c/amen", false), missing: true },
    ];
    await player.startPrayAlong(TARGET, { chosen: "la", title: "Memorare" });
    // "Preparing the audio…", then the reason, with no wait in between.
    expect(statuses).toEqual(["loading", "missing"]);
    expect(player.getPlayerState()).toEqual({ status: "missing", targetId: "prayer:memorare::" });
    // Only the press's own short silence ever started, and it was stopped.
    expect(audio().played).toEqual([PRESS_SILENCE]);
    expect(audio().paused).toBe(true);
    audio().end();
    await settle();
    expect(audio().played).toEqual([PRESS_SILENCE]);
    expect(playlistAsks).toBe(1);
  });

  it("ends the prayer with the reason when a line it is waiting for can now never be said", async () => {
    items = [clip("/c/ave"), clip("/c/amen", false)];
    await press();
    expect(status()).toBe("playing");
    expect(audio().src).toBe("/c/ave");
    audio().end();
    // The Amen is being made: silence while it is waited for.
    expect(status()).toBe("waiting");
    expect(audio().src).toBe(WAIT_SILENCE);
    // The engine gives up on it in both voices; the next ask learns so.
    items = [clip("/c/ave"), { ...clip("/c/amen", false), missing: true }];
    later(3_000);
    audio().end();
    await settle();
    expect(status()).toBe("missing");
    expect(audio().played).not.toContain("/c/amen");
    expect(audio().src).toBe("");
  });

  it("does not count time paused as time waited: resuming after a long pause prays on", async () => {
    items = [clip("/c/ave"), clip("/c/amen", false)];
    await press();
    audio().end();
    expect(status()).toBe("waiting");
    later(10_000);
    player.pausePrayAlong();
    expect(status()).toBe("paused");
    // The reader's own pause is said once, though the element announces it too.
    expect(statuses.filter((s) => s === "paused")).toHaveLength(1);
    // Five minutes away, far past the two-minute wait for a clip.
    later(5 * 60_000);
    player.resumePrayAlong();
    expect(status()).toBe("waiting");
    later(3_000);
    audio().end();
    await settle();
    // About 13 s waited, not five minutes: still waiting, and asking again.
    expect(status()).toBe("waiting");
    expect(playlistAsks).toBe(2);
    // The Amen is made: it plays, and the prayer is prayed to its end.
    items = [clip("/c/ave"), clip("/c/amen")];
    later(3_000);
    audio().end();
    await settle();
    audio().end();
    expect(audio().src).toBe("/c/amen");
    expect(status()).toBe("playing");
    audio().end();
    expect(status()).toBe("finished");
  });

  it("takes Pause pressed while a file is still starting as a pause, not as an error", async () => {
    items = [clip("/c/ave"), clip("/c/amen", false)];
    await press();
    // The wait's silence is still loading when the reader presses Pause: the browser
    // cuts its play() short with an AbortError.
    audio().hold = true;
    audio().end();
    expect(status()).toBe("waiting");
    player.pausePrayAlong();
    await settle();
    expect(status()).toBe("paused");
    // Resumed, and paused again before the silence had started: still only paused.
    player.resumePrayAlong();
    expect(status()).toBe("waiting");
    player.pausePrayAlong();
    await settle();
    expect(status()).toBe("paused");
    // Resumed for good, it goes on waiting and prays the Amen once it is made.
    audio().hold = false;
    player.resumePrayAlong();
    await settle();
    expect(status()).toBe("waiting");
    items = [clip("/c/ave"), clip("/c/amen")];
    later(3_000);
    audio().end();
    await settle();
    audio().end();
    expect(audio().src).toBe("/c/amen");
    audio().end();
    expect(status()).toBe("finished");
  });

  it("takes a pause the device makes itself (a phone call) as a pause the reader can resume", async () => {
    items = [clip("/c/ave"), clip("/c/amen")];
    await press();
    expect(status()).toBe("playing");
    audio().interrupt();
    // Taken for the device's once the player has looked again (a file's own end also
    // fires "pause", just before "ended").
    expect(status()).toBe("playing");
    await new Promise((r) => setTimeout(r, 350));
    // Said, and the button now offers to resume (the lock screen's Play works too).
    expect(status()).toBe("paused");
    player.resumePrayAlong();
    expect(status()).toBe("playing");
    expect(audio().paused).toBe(false);
    audio().end();
    expect(audio().src).toBe("/c/amen");
    // A file's own end (its "pause" event comes first) is never taken for a pause.
    await new Promise((r) => setTimeout(r, 350));
    expect(status()).toBe("playing");
    audio().end();
    expect(statuses).not.toContain("error");
    expect(status()).toBe("finished");
    expect(statuses.filter((s) => s === "paused")).toHaveLength(1);
  });

  it("goes on when the press's own short silence would not load before the playlist came", async () => {
    items = [clip("/c/ave")];
    const started = player.startPrayAlong(TARGET, { chosen: "la", title: "Memorare" });
    // The silence fails while the playlist is still on its way (no session yet).
    audio().fail();
    await started;
    await settle();
    expect(audio().src).toBe("/c/ave");
    expect(status()).toBe("playing");
    audio().end();
    expect(status()).toBe("finished");
  });

  it("still ends the prayer when the browser refuses to play, as it did", async () => {
    items = [clip("/c/ave")];
    await player.startPrayAlong(TARGET, { chosen: "la", title: "Memorare" });
    audio().play = () => Promise.reject(new DOMException("Not allowed.", "NotAllowedError"));
    audio().end();
    await settle();
    expect(status()).toBe("error");
  });

  it("still ends a wait of more than two minutes, not paused, as not ready yet", async () => {
    items = [clip("/c/ave"), clip("/c/amen", false)];
    await press();
    audio().end();
    expect(status()).toBe("waiting");
    later(60_000);
    player.pausePrayAlong();
    later(30_000);
    player.resumePrayAlong();
    // 60 s waited before the pause and 61 s after it: past the two minutes.
    later(61_000);
    audio().end();
    await settle();
    expect(status()).toBe("unavailable");
  });

  it("ends the prayer with a message when a clip will not load, instead of a silence without end", async () => {
    items = [clip("/c/ave")];
    await press();
    expect(audio().src).toBe("/c/ave");
    for (let attempt = 1; attempt < 3; attempt++) {
      audio().fail();
      // Taken for not made yet: waited for, asked for again, and tried again.
      expect(status()).toBe("waiting");
      expect(audio().src).toBe(WAIT_SILENCE);
      later(3_000);
      audio().end();
      await settle();
      audio().end();
      expect(audio().src).toBe("/c/ave");
    }
    audio().fail();
    expect(status()).toBe("error");
    expect(audio().played.filter((u) => u === "/c/ave")).toHaveLength(3);
  });
});
