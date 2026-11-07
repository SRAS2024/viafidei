"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

import { useLocalToday } from "@/components/ui/useLocalToday";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** How long the router gets to commit the correction before the page is loaded afresh. */
const ROUTER_GRACE_MS = 2000;

/** How long that waits after a press: longer than any navigation still worth waiting for. */
const PRESS_GRACE_MS = 30_000;

/** Set on a history entry whose date came from here, and so still means "today". */
const FOLLOWS_TODAY = "vfFollowsToday";

/** The address this has asked for, kept for the page that arrives there by either road. */
const ASKED_KEY = "vf_saints_today_asked";

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

/** Where the reader was in the list, for the page at `address`. */
type Place = { address: string; y: number; card: number | null };

/** The same, kept for a page that arrives by the fallback's full load. */
const PLACE_KEY = "vf_saints_today_place";

/** The place being followed while a correction is on its way, in this document. */
let held: { place: Place; stop: () => void } | null = null;

const cardLinks = () => [...document.querySelectorAll<HTMLElement>("main .vf-entry-link")];

function savePlace(place: Place | null) {
  try {
    if (place) window.sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
    else window.sessionStorage.removeItem(PLACE_KEY);
  } catch {
    // Without storage, only the full load's fallback starts at the top.
  }
}

function savedPlace(): Place | null {
  try {
    const place = JSON.parse(window.sessionStorage.getItem(PLACE_KEY) ?? "null") as Place | null;
    return place && typeof place.address === "string" && typeof place.y === "number" ? place : null;
  } catch {
    return null;
  }
}

function releasePlace() {
  held?.stop();
  held = null;
  savePlace(null);
}

/**
 * Follows the reader's scroll and focus until the corrected list arrives. The list is
 * replaced whole, and WebKit, Safari's engine, puts the page back at the top as it
 * does, whatever the router was told; a focused card goes with the list, everywhere.
 */
function holdPlace(address: string) {
  releasePlace();
  const place: Place = { address, y: 0, card: null };
  const note = () => {
    place.y = window.scrollY;
    const card = cardLinks().indexOf(document.activeElement as HTMLElement);
    place.card = card >= 0 ? card : null;
    savePlace(place);
  };
  note();
  window.addEventListener("scroll", note, { passive: true });
  document.addEventListener("focusin", note);
  held = {
    place,
    stop: () => {
      window.removeEventListener("scroll", note);
      document.removeEventListener("focusin", note);
    },
  };
}

/**
 * Puts the reader back where they were once the list for `address` is in: the same
 * height on the page, and focus on the card in the same position, when it was on a card
 * that went. This runs before the page is painted, so nothing is seen to jump.
 */
function restorePlace() {
  const address = window.location.pathname + window.location.search;
  const place = held?.place ?? savedPlace();
  if (!place || place.address !== address) return;
  releasePlace();
  const active = document.activeElement;
  if (place.card !== null && (!active || active === document.body)) {
    const cards = cardLinks();
    cards[Math.min(place.card, cards.length - 1)]?.focus({ preventScroll: true });
  }
  if (Math.round(window.scrollY) !== Math.round(place.y)) {
    window.scrollTo({ top: place.y, behavior: "instant" });
  }
}

type Props = {
  /** Month the list was read for (1-indexed) — shown until the client hydrates. */
  serverMonth: number;
  /** Day the list was read for — shown until the client hydrates. */
  serverDay: number;
  /** The URL names the date, so the list is that date's whatever today is. */
  dateFromUrl?: boolean;
};

/**
 * Renders the date under the page's title: always the date the list below is
 * for. On first render that is the month and day the server used (avoiding a
 * hydration mismatch), and the year joins it when that date is today on the
 * reader's device.
 *
 * A plain visit to the page reads the server's clock, whose day can differ from the
 * reader's by the evening, so it asks for the reader's own day instead of labelling one
 * day's saints with another's date. It goes on asking: a tab left open overnight moves
 * on with the device's date, even once its address names a date. The history entry
 * remembers that it asked, not the address, so a link shared from here stays that date,
 * and so does the same date opened from the homepage's link.
 *
 * Getting there is not left to one client navigation, as in TodayDateSync: the router
 * has been seen to fetch a page and never commit it, with no error. So if the address
 * has not changed shortly after asking, the page is simply loaded at the right address.
 * A press puts that off, because a link still on its way or a menu just opened would be
 * thrown away with the page. Leaving for another page, or the router getting there,
 * cancels it.
 */
export function TodayDateLabel({ serverMonth, serverDay, dateFromUrl = false }: Props) {
  const router = useRouter();
  const today = useLocalToday();
  const todayMonth = today ? Number(today.slice(5, 7)) : null;
  const todayDay = today ? Number(today.slice(8, 10)) : null;
  const listIsToday = todayMonth === serverMonth && todayDay === serverDay;

  // The list this date names is in: the reader goes back to their place in it.
  useLayoutEffect(restorePlace, [serverMonth, serverDay]);

  useEffect(() => {
    if (!today) return;
    const address = () => window.location.pathname + window.location.search;
    // Arrived at what was asked for. The router clears an entry's state as it commits,
    // so this is the moment to mark it, on whichever road the page came.
    if (readAsked() === address()) {
      writeAsked(null);
      window.history.replaceState({ ...window.history.state, [FOLLOWS_TODAY]: true }, "");
    }
    const asksForToday = !dateFromUrl || window.history.state?.[FOLLOWS_TODAY] === true;
    if (!asksForToday || listIsToday) return;
    const target = `/saints/today?month=${todayMonth}&day=${todayDay}`;
    if (address() === target) return;
    writeAsked(target);
    // The midnight that moves this can come with a reader part-way down the list.
    holdPlace(target);
    router.replace(target, { scroll: false });
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
  }, [today, todayMonth, todayDay, listIsToday, dateFromUrl, router]);

  // A correction the visitor overtook by leaving is forgotten, or the same address opened
  // later from a link would be taken for it.
  useEffect(
    () => () => {
      if (window.location.pathname === "/saints/today") return;
      writeAsked(null);
      releasePlace();
    },
    [],
  );

  const named = `${MONTH_NAMES[serverMonth - 1] ?? "—"} ${serverDay}`;
  const label = today && listIsToday ? `${named}, ${Number(today.slice(0, 4))}` : named;

  return <p className="vf-page-hero-lede">{label}</p>;
}
