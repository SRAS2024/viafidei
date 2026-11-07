"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** The device's own calendar date, as YYYY-MM-DD. */
export function localIsoDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The start of the next local day, which a clock change can move, so it is asked for by date. */
function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const reread = () => {
    // A timer sleeps with the device, so every return to the page sets it afresh.
    clearTimeout(timer);
    timer = setTimeout(reread, msUntilLocalMidnight());
    onChange();
  };
  timer = setTimeout(reread, msUntilLocalMidnight());
  document.addEventListener("visibilitychange", reread);
  window.addEventListener("focus", reread);
  // A page restored from the back/forward cache comes back as it was left.
  window.addEventListener("pageshow", reread);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", reread);
    window.removeEventListener("focus", reread);
    window.removeEventListener("pageshow", reread);
  };
}

/**
 * "Today" for everything that shows the day: the visitor's own date, read from the
 * device, and kept true while the page stays open. A phone tab left on the homepage
 * overnight is a normal way to meet this page, so the date is read again at local
 * midnight and whenever the visitor comes back to the tab.
 *
 * Null on the server and during hydration, which do not know the device's date, so
 * the first render matches the server's and each block holds its place until then.
 */
export function useLocalToday(): string | null {
  return useSyncExternalStore<string | null>(subscribe, localIsoDate, () => null);
}

/** Less time away than this is a moment's interruption, not leaving. */
const MOMENT_AWAY_MS = 30 * 60_000;

/**
 * "Today" for what must not change under someone who is reading it: the date as of this
 * visit. Someone praying past midnight, or a voice part-way down the page, keeps their
 * place, so midnight does not move it and nor does a moment in another app. It is read on
 * arrival and again when the visitor comes back from being away a while, which is how a
 * tab left open overnight moves on the next time it is looked at.
 *
 * Null on the server and during hydration, as useLocalToday is.
 */
export function useVisitDay(): string | null {
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    setDay(localIsoDate());
    // When the visitor left, or when the page opened if they have not been seen to. A
    // visitor leaves by more than one event at once, and only the first is the moment.
    let leftAt = Date.now();
    let away = false;
    const left = () => {
      if (!away) leftAt = Date.now();
      away = true;
    };
    const cameBack = () => {
      if (document.visibilityState === "hidden") return left();
      away = false;
      if (Date.now() - leftAt >= MOMENT_AWAY_MS) setDay(localIsoDate());
    };
    document.addEventListener("visibilitychange", cameBack);
    window.addEventListener("blur", left);
    window.addEventListener("pagehide", left);
    window.addEventListener("focus", cameBack);
    // A page restored from the back/forward cache comes back as it was left.
    window.addEventListener("pageshow", cameBack);
    return () => {
      document.removeEventListener("visibilitychange", cameBack);
      window.removeEventListener("blur", left);
      window.removeEventListener("pagehide", left);
      window.removeEventListener("focus", cameBack);
      window.removeEventListener("pageshow", cameBack);
    };
  }, []);
  return day;
}
