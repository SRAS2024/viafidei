"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { usePrayerLanguage } from "@/components/ui/PrayerLanguageChips";

import {
  getPlayerState,
  pausePrayAlong,
  resumePrayAlong,
  startPrayAlong,
  stopPrayAlong,
  subscribePlayer,
  targetIdOf,
  type PlayerState,
  type PrayAlongTarget,
} from "./player";

/** The player's words in the reader's language; the button labels carry a {title}. */
export interface PrayAlongLabels {
  play: string;
  pause: string;
  resume: string;
  stop: string;
  preparing: string;
  loading: string;
  playing: string;
  paused: string;
  waiting: string;
  stopped: string;
  finished: string;
  unavailable: string;
  error: string;
}

const ENGLISH: PrayAlongLabels = {
  play: "Pray along: {title}",
  pause: "Pause praying along: {title}",
  resume: "Resume praying along: {title}",
  stop: "Stop praying along: {title}",
  preparing: "Preparing the audio for {title}",
  loading: "Preparing the audio…",
  playing: "Praying along.",
  paused: "Paused.",
  waiting: "The next part is being prepared…",
  stopped: "Stopped.",
  finished: "Finished.",
  unavailable: "The audio for this prayer is not ready yet. Please try again in a little while.",
  error: "The audio could not be played.",
};

const LabelsContext = createContext<PrayAlongLabels>(ENGLISH);

/** Given once by the root layout, like the Share button's words. */
export function PrayAlongLabelsProvider({
  labels,
  children,
}: {
  labels: PrayAlongLabels;
  children: ReactNode;
}) {
  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

/** The megaphone: a cone with a handle, and two sound waves. */
function MegaphoneGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 10.2v3.6c0 .6.4 1 1 1H7l7.2 4.1c.7.4 1.3 0 1.3-.7V5.8c0-.8-.6-1.1-1.3-.7L7 9.2H4.5c-.6 0-1 .4-1 1Z" />
      <path d="M7.2 14.8 8.4 19.2c.1.5.6.8 1.1.8h.7c.6 0 1-.6.8-1.2l-1.1-3.4" />
      <path d="M18.2 9.3c.8.7 1.2 1.6 1.2 2.7s-.4 2-1.2 2.7" />
      <path d="M20.1 7.2c1.4 1.3 2.1 3 2.1 4.8s-.7 3.5-2.1 4.8" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

const ACTIVE = new Set(["loading", "playing", "paused", "waiting"]);

/**
 * The pray-along button: a small megaphone that prays `target` aloud (the Sign of the
 * Cross, the prayer, the Sign of the Cross) in the reader's language, or in Latin or
 * Greek when they chose it on the chips.
 *
 * For VoiceOver: a real button whose name says what it will do ("Pray along: Hail
 * Mary", then "Pause praying along: Hail Mary", "Resume…"), a Stop button beside it
 * while a prayer is under way, and every change said in a status region ("Paused.",
 * "Finished."). It never takes `disabled`, which would drop focus to the top of the
 * page; when Stop disappears, focus returns to the megaphone. Keyboard: both are
 * ordinary buttons. Nothing plays until it is pressed.
 */
export function PrayAlongButton({
  target,
  title,
  className = "",
}: {
  target: PrayAlongTarget;
  /** What is prayed, as the page names it ("Hail Mary", "Day 3", "the Joyful Mysteries"). */
  title: string;
  className?: string;
}) {
  const labels = useContext(LabelsContext);
  const { language } = usePrayerLanguage();
  const [player, setPlayer] = useState<PlayerState>(() => getPlayerState());
  const mainRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const id = targetIdOf(target);
  const mine = player.targetId === id;
  const status = mine ? player.status : "idle";
  const active = ACTIVE.has(status);

  useEffect(() => subscribePlayer(setPlayer), []);

  // Stop vanishes when the prayer ends: focus that was on it comes back to the megaphone.
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active && document.activeElement === document.body) {
      mainRef.current?.focus();
    }
    wasActive.current = active;
  }, [active]);

  const named = (template: string) => template.replace("{title}", () => title);

  let label = named(labels.play);
  if (status === "playing" || status === "waiting") label = named(labels.pause);
  else if (status === "paused") label = named(labels.resume);
  else if (status === "loading") label = named(labels.preparing);

  const message = !mine
    ? ""
    : ({
        idle: "",
        loading: labels.loading,
        playing: labels.playing,
        paused: labels.paused,
        waiting: labels.waiting,
        finished: labels.finished,
        stopped: labels.stopped,
        unavailable: labels.unavailable,
        error: labels.error,
      }[status] ?? "");

  function onMain() {
    if (status === "playing" || status === "waiting") pausePrayAlong();
    else if (status === "paused") resumePrayAlong();
    else if (status === "loading") return;
    else void startPrayAlong(target, { chosen: language, title });
  }

  function onStop() {
    const focusWasOnStop = document.activeElement === stopRef.current;
    stopPrayAlong();
    if (focusWasOnStop) mainRef.current?.focus();
  }

  return (
    <span className={`vf-pray-along ${className}`.trim()} data-status={status}>
      <button
        ref={mainRef}
        type="button"
        onClick={onMain}
        aria-label={label}
        title={label}
        className="vf-btn vf-btn-sm vf-btn-ghost vf-pray-along-button"
      >
        {status === "playing" || status === "waiting" ? <PauseGlyph /> : <MegaphoneGlyph />}
      </button>
      {status === "playing" ? (
        // A small level meter for sighted readers; still for those who asked for less motion.
        <span className="vf-pray-along-level" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {active ? (
        <button
          ref={stopRef}
          type="button"
          onClick={onStop}
          aria-label={named(labels.stop)}
          title={named(labels.stop)}
          className="vf-btn vf-btn-sm vf-btn-ghost vf-pray-along-button"
        >
          <StopGlyph />
        </button>
      ) : null}
      <span role="status" className="sr-only">
        {message}
      </span>
    </span>
  );
}
