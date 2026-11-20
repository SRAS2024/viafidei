/**
 * The one pray-along player on a page.
 *
 * Every button shares it, so starting one prayer stops any other. It plays the
 * playlist the server builds (/api/pray-along) through a single <audio> element:
 * the clips in order, and each pause as a short silent clip rather than a timer, so a
 * phone keeps praying with its screen locked (a backgrounded page's timers stop; its
 * audio does not). A clip the voice engine is still making is waited for, with
 * silence playing meanwhile, and asked for again every few seconds.
 *
 * Nothing plays until a person presses a button (no autoplay). The lock screen and
 * headphone controls drive it through the Media Session API. Everything plays at the
 * reader's speed (rate-store.ts), pitch kept.
 *
 * Browser only.
 */

import { adoptAccountRate, getRate, rateChanges, subscribeRate } from "./rate-store";

export type PrayAlongKind = "prayer" | "novena" | "rosary" | "guide";

export interface PrayAlongTarget {
  kind: PrayAlongKind;
  slug?: string;
  /** 1-based novena day. */
  day?: number;
  /** Rosary mystery set. */
  set?: string;
}

export type PlayerStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "waiting"
  | "finished"
  | "stopped"
  | "unavailable"
  | "error";

export interface PlayerState {
  status: PlayerStatus;
  /** The button whose prayer this is (`targetIdOf`), or null when nothing was started. */
  targetId: string | null;
}

type ManifestItem = { type: "clip"; url: string; ready: boolean } | { type: "pause"; ms: number };

interface Manifest {
  title: string;
  items: ManifestItem[];
  /** The speed a signed-in member's account keeps (null when none, or signed out). */
  rate?: number | null;
  member?: boolean;
}

interface Session {
  token: number;
  target: PrayAlongTarget;
  chosen: string | null;
  title: string;
  items: ManifestItem[];
  index: number;
  /** When the current wait for an unmade clip began (ms), or null. */
  waitingSince: number | null;
  lastPoll: number;
  pausedWhile: "playing" | "waiting" | null;
  /** A clip has played: a later wait is for "the next part", the first is "preparing". */
  started: boolean;
}

/** How long to wait for a clip the engine has not made before saying it is not ready. */
const MAX_WAIT_MS = 120_000;
/** How often to ask again while waiting. */
const POLL_MS = 2_500;

const SILENCES = [300, 700, 1100, 1300, 1800] as const;

function silenceUrl(ms: number): string {
  const nearest = SILENCES.reduce((best, s) => (Math.abs(s - ms) < Math.abs(best - ms) ? s : best));
  return `/audio/silence-${nearest}.m4a`;
}

export function targetIdOf(target: PrayAlongTarget): string {
  return [target.kind, target.slug ?? "", target.day ?? "", target.set ?? ""].join(":");
}

let state: PlayerState = { status: "idle", targetId: null };
const listeners = new Set<(s: PlayerState) => void>();
let audio: HTMLAudioElement | null = null;
let session: Session | null = null;
let tokens = 0;
/** What the element is playing now: a clip, a pause, or the silence of a wait. */
let playing: "clip" | "pause" | "wait" | null = null;
/** Load errors in a row: a file that will not load is given up on, never retried in a spin. */
let errorsInARow = 0;
const MAX_ERRORS_IN_A_ROW = 3;

function setState(next: PlayerState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

export function getPlayerState(): PlayerState {
  return state;
}

export function subscribePlayer(listener: (s: PlayerState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Sets the element's speed; a new source starts at the default rate, so both are set. */
function applyRate(el: HTMLAudioElement): void {
  const rate = getRate();
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  // A faster prayer keeps its voice: the pitch stays where it was.
  audio.preservesPitch = true;
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);
  applyRate(audio);
  // A new speed takes hold at once, in the middle of a clip too.
  subscribeRate(() => {
    if (audio) applyRate(audio);
  });
  return audio;
}

function params(target: PrayAlongTarget, chosen: string | null): string {
  const p = new URLSearchParams({ kind: target.kind });
  if (target.slug) p.set("slug", target.slug);
  if (target.day != null) p.set("day", String(target.day));
  if (target.set) p.set("set", target.set);
  if (chosen) p.set("chosen", chosen);
  return p.toString();
}

async function fetchManifest(
  target: PrayAlongTarget,
  chosen: string | null,
): Promise<Manifest | "unavailable" | "error"> {
  try {
    const res = await fetch(`/api/pray-along?${params(target, chosen)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return "unavailable";
    if (!res.ok) return "error";
    const body = (await res.json()) as Manifest;
    return Array.isArray(body.items) ? body : "error";
  } catch {
    return "error";
  }
}

function setMediaSession(title: string | null): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const ms = navigator.mediaSession;
    if (!title) {
      ms.metadata = null;
      ms.playbackState = "none";
      return;
    }
    ms.metadata = new MediaMetadata({ title, artist: "Via Fidei" });
    ms.setActionHandler("play", () => resumePrayAlong());
    ms.setActionHandler("pause", () => pausePrayAlong());
    ms.setActionHandler("stop", () => stopPrayAlong());
  } catch {
    // An older browser without the full API still plays.
  }
}

function setPlaybackState(value: "playing" | "paused" | "none"): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = value;
  } catch {
    // ignore
  }
}

function play(url: string, what: "clip" | "pause" | "wait"): void {
  const el = element();
  playing = what;
  el.src = url;
  applyRate(el);
  void el.play().catch(() => {
    // A refused play (a browser that lost the press that allowed it) stops cleanly.
    if (session) finish("error");
  });
}

/** Warms the browser's cache with the next clips, so one follows another without a gap. */
function prefetchAhead(s: Session): void {
  let warmed = 0;
  for (let i = s.index + 1; i < s.items.length && warmed < 2; i++) {
    const item = s.items[i]!;
    if (item.type !== "clip") continue;
    if (!item.ready) break;
    warmed += 1;
    void fetch(item.url, { cache: "force-cache" }).catch(() => undefined);
  }
}

function advance(): void {
  const s = session;
  if (!s) return;
  if (s.index >= s.items.length) {
    finish("finished");
    return;
  }
  const item = s.items[s.index]!;
  if (item.type === "pause") {
    play(silenceUrl(item.ms), "pause");
    return;
  }
  if (!item.ready) {
    if (s.waitingSince == null) s.waitingSince = Date.now();
    const waiting = s.started ? "waiting" : "loading";
    if (state.status !== waiting) setState({ status: waiting, targetId: state.targetId });
    void poll(s);
    play(silenceUrl(1100), "wait");
    return;
  }
  s.waitingSince = null;
  s.started = true;
  if (state.status !== "playing") setState({ status: "playing", targetId: state.targetId });
  play(item.url, "clip");
  prefetchAhead(s);
}

/** Asks for the playlist again while a clip is being made; gives up after a while. */
async function poll(s: Session): Promise<void> {
  if (Date.now() - s.lastPoll < POLL_MS) return;
  s.lastPoll = Date.now();
  if (s.waitingSince != null && Date.now() - s.waitingSince > MAX_WAIT_MS) {
    finish("unavailable");
    return;
  }
  const next = await fetchManifest(s.target, s.chosen);
  if (session !== s || typeof next === "string") return;
  // Same script, fresher readiness: keep our place.
  if (next.items.length === s.items.length) s.items = next.items;
}

function onEnded(): void {
  const s = session;
  if (!s) return;
  errorsInARow = 0;
  if (playing === "wait") {
    // Still waiting: play the silence again, or go on if the clip is now made.
    advance();
    return;
  }
  s.index += 1;
  advance();
}

function onError(): void {
  const s = session;
  if (!s) return;
  errorsInARow += 1;
  if (errorsInARow >= MAX_ERRORS_IN_A_ROW) {
    errorsInARow = 0;
    finish("error");
    return;
  }
  if (playing === "clip") {
    // The clip could not be fetched: treat it as not made yet and wait for it.
    const item = s.items[s.index];
    if (item && item.type === "clip") item.ready = false;
    advance();
  } else {
    s.index += playing === "pause" ? 1 : 0;
    advance();
  }
}

function finish(status: "finished" | "stopped" | "unavailable" | "error"): void {
  const el = audio;
  session = null;
  playing = null;
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  setMediaSession(null);
  setState({ status, targetId: state.targetId });
}

/** Starts praying `target` (stopping whatever else was playing). Call from a press. */
export async function startPrayAlong(
  target: PrayAlongTarget,
  opts: { chosen: string | null; title: string },
): Promise<void> {
  if (session) finish("stopped");
  errorsInARow = 0;
  const token = ++tokens;
  const el = element();
  // Begin inside the press: browsers allow sound only from one, and a short silence
  // now lets the prayer itself start once its playlist arrives.
  playing = "pause";
  el.src = silenceUrl(300);
  applyRate(el);
  void el.play().catch(() => undefined);
  setState({ status: "loading", targetId: targetIdOf(target) });
  const changesAtRequest = rateChanges();
  const manifest = await fetchManifest(target, opts.chosen);
  if (token !== tokens) return;
  if (typeof manifest === "string") {
    finish(manifest);
    return;
  }
  // A member's saved speed follows them to this browser.
  adoptAccountRate(
    { member: manifest.member === true, rate: manifest.rate ?? null },
    changesAtRequest,
  );
  session = {
    token,
    target,
    chosen: opts.chosen,
    title: manifest.title || opts.title,
    items: manifest.items,
    index: 0,
    waitingSince: null,
    lastPoll: Date.now(),
    pausedWhile: null,
    started: false,
  };
  setMediaSession(session.title);
  setPlaybackState("playing");
  // The short silence may still be playing: its end advances to the first item.
  if (el.ended || el.paused) advance();
  else {
    playing = "pause";
    session.index = -1;
  }
}

export function pausePrayAlong(): void {
  const s = session;
  if (!s || (state.status !== "playing" && state.status !== "waiting")) return;
  s.pausedWhile = state.status === "waiting" ? "waiting" : "playing";
  element().pause();
  setPlaybackState("paused");
  setState({ status: "paused", targetId: state.targetId });
}

export function resumePrayAlong(): void {
  const s = session;
  if (!s || state.status !== "paused") return;
  const back = s.pausedWhile === "waiting" ? "waiting" : "playing";
  s.pausedWhile = null;
  setState({ status: back, targetId: state.targetId });
  setPlaybackState("playing");
  void element()
    .play()
    .catch(() => finish("error"));
}

export function stopPrayAlong(): void {
  if (!session && state.status !== "loading") return;
  tokens += 1;
  finish("stopped");
}

/**
 * The buttons on the page, by target. A prayer whose button has gone (the reader left
 * the page, or folded its novena day away) stops, rather than praying on with nothing
 * on the page to pause or stop it.
 */
const mounted = new Map<string, number>();

export function registerPrayAlongButton(targetId: string): () => void {
  mounted.set(targetId, (mounted.get(targetId) ?? 0) + 1);
  return () => {
    const left = (mounted.get(targetId) ?? 1) - 1;
    if (left > 0) mounted.set(targetId, left);
    else mounted.delete(targetId);
    // After a moment, so a button that is only re-rendered is not taken for gone.
    setTimeout(() => {
      if (
        !mounted.has(targetId) &&
        state.targetId === targetId &&
        (session || state.status === "loading")
      ) {
        stopPrayAlong();
      }
    }, 400);
  };
}
