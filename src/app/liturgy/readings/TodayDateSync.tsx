"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitDay } from "@/components/ui/useLocalToday";

/** How long the router gets to commit the correction before the page is loaded afresh. */
const ROUTER_GRACE_MS = 2000;

/** How long that waits after a press: longer than any navigation still worth waiting for. */
const PRESS_GRACE_MS = 30_000;

/** Set on a history entry whose date came from here, and so still means "today". */
const FOLLOWS_TODAY = "vfFollowsToday";

/** The address the sync has asked for, kept for the page that arrives there by either road. */
const ASKED_KEY = "vf_readings_today_asked";

function readAsked(): string | null {
  try {
    return window.sessionStorage.getItem(ASKED_KEY);
  } catch {
    return null;
  }
}

function writeAsked(address: string | null) {
  try {
    if (address) window.sessionStorage.setItem(ASKED_KEY, address);
    else window.sessionStorage.removeItem(ASKED_KEY);
  } catch {
    // Storage can be refused. The date is still corrected; the tab just stops following it.
  }
}

/**
 * "Today" self-correction.
 *
 * The server renders the UTC civil date when the visitor names no usable ?date
 * (Railway runs in UTC), so a visitor in the Americas on a Saturday evening would
 * otherwise be shown Sunday's Mass. Once mounted we know the device's own calendar
 * date; if it differs from what was rendered we replace the URL with it, which
 * re-renders the correct day and leaves a shareable, unambiguous link behind.
 *
 * A tab that asked for today goes on asking, whatever the hour it was opened: when the
 * visitor comes back to it on a later day it moves on. The history entry remembers
 * that, not the address, so a link shared from here stays that date, and so does the
 * same date opened from the calendar. It never moves while someone is reading.
 *
 * Getting the visitor's own day is not left to one client navigation. In WebKit the
 * router has been seen to fetch the new page and never commit it, with no error, and
 * the wrong day then stays on screen. So if the address has not changed shortly
 * after asking, the page is simply loaded at the right address. A press puts that off,
 * because a link still on its way or a menu just opened would be thrown away with the
 * page. Leaving for another page, or the router getting there, cancels it.
 *
 * Only active when the visitor asked for "today" — an explicit date from the
 * calendar or a shared link is never rewritten.
 */
export function TodayDateSync({
  renderedDate,
  enabled,
}: {
  renderedDate: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const today = useVisitDay();
  useEffect(() => {
    if (!today) return;
    const address = () => window.location.pathname + window.location.search;
    // Arrived at what was asked for. The router clears an entry's state as it commits,
    // so this is the moment to mark it, on whichever road the page came.
    if (readAsked() === address()) {
      writeAsked(null);
      window.history.replaceState({ ...window.history.state, [FOLLOWS_TODAY]: true }, "");
    }
    const asksForToday = enabled || window.history.state?.[FOLLOWS_TODAY] === true;
    if (!asksForToday || today === renderedDate) return;
    // Whatever else the visitor asked for stays: the Vigil stays the Vigil.
    const others = new URLSearchParams(window.location.search);
    others.delete("date");
    const rest = others.toString();
    const target = `/liturgy/readings?date=${today}${rest ? `&${rest}` : ""}`;
    // A device set outside the calendar's years would otherwise reload for ever.
    if (address() === target) return;
    writeAsked(target);
    router.replace(target);
    const load = () => {
      if (address() !== target) window.location.replace(target);
    };
    let fallback = window.setTimeout(load, ROUTER_GRACE_MS);
    const putOff = () => {
      window.clearTimeout(fallback);
      fallback = window.setTimeout(load, PRESS_GRACE_MS);
    };
    document.addEventListener("click", putOff, true);
    document.addEventListener("submit", putOff, true);
    window.addEventListener("popstate", putOff);
    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener("click", putOff, true);
      document.removeEventListener("submit", putOff, true);
      window.removeEventListener("popstate", putOff);
    };
  }, [enabled, renderedDate, router, today]);
  // A correction the visitor overtook by leaving is forgotten, or the same address opened
  // later from a link would be taken for it.
  useEffect(
    () => () => {
      if (window.location.pathname !== "/liturgy/readings") writeAsked(null);
    },
    [],
  );
  return null;
}
