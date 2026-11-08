"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useVisitMoment } from "@/components/ui/useLocalToday";
import { prefersEveningMass } from "@/lib/content-shared/mass-default";

/** How long the router gets to commit the correction before the page is loaded afresh. */
const ROUTER_GRACE_MS = 2000;

/** How long that waits after a press: longer than any navigation still worth waiting for. */
const PRESS_GRACE_MS = 30_000;

/** Set on a history entry whose date came from here, and so still means "today". */
const FOLLOWS_TODAY = "vfFollowsToday";

/** Set on a history entry whose evening Mass came from the clock, not from a choice. */
const MASS_BY_CLOCK = "vfMassByClock";

/** The address the sync has asked for, kept for the page that arrives there by either road. */
const ASKED_KEY = "vf_readings_today_asked";

interface Asked {
  /** The address asked for. */
  to: string;
  /** Its date stands for "today". */
  today: boolean;
  /** Its evening Mass stands for the afternoon, not for a choice. */
  clock: boolean;
}

function readAsked(): Asked | null {
  try {
    const raw = window.sessionStorage.getItem(ASKED_KEY);
    if (!raw) return null;
    // Before the clock had a say only the address was kept, and it always meant today.
    if (raw.startsWith("/")) return { to: raw, today: true, clock: false };
    const asked = JSON.parse(raw) as Partial<Asked>;
    return typeof asked.to === "string"
      ? { to: asked.to, today: asked.today === true, clock: asked.clock === true }
      : null;
  } catch {
    return null;
  }
}

function writeAsked(asked: Asked | null) {
  try {
    if (asked) window.sessionStorage.setItem(ASKED_KEY, JSON.stringify(asked));
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
 * On the visitor's current day, from noon on their device, a date with an evening Mass
 * opens on that Mass when the address chose none (`prefersEveningMass`): someone reading
 * Saturday's readings in the afternoon is most likely going to Sunday's Mass that
 * evening. Any choice in the address wins (?mass=day is the day's own Mass), and every
 * other date opens on its own Mass.
 *
 * A tab that asked for today goes on asking, whatever the hour it was opened: when the
 * visitor comes back to it on a later day it moves on, and an evening Mass the clock
 * chose stays behind with the afternoon it was chosen for. The history entry remembers
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
 * The date is only corrected when the visitor asked for "today" — an explicit date from
 * the calendar or a shared link is never rewritten.
 */
export function TodayDateSync({
  renderedDate,
  enabled,
  eveningHref = null,
  massChosen = false,
}: {
  renderedDate: string;
  enabled: boolean;
  /** The rendered date's evening Mass, when it has one beside the Mass shown. */
  eveningHref?: string | null;
  /** True when the address chose a Mass (?mass, ?variant or ?ascension). */
  massChosen?: boolean;
}) {
  const router = useRouter();
  const visit = useVisitMoment();
  const today = visit?.day ?? null;
  const evening = prefersEveningMass(renderedDate, visit);
  useEffect(() => {
    if (!today) return;
    const address = () => window.location.pathname + window.location.search;
    // Arrived at what was asked for. The router clears an entry's state as it commits,
    // so this is the moment to mark it, on whichever road the page came.
    const asked = readAsked();
    if (asked?.to === address()) {
      writeAsked(null);
      const marks: Record<string, boolean> = {};
      if (asked.today) marks[FOLLOWS_TODAY] = true;
      if (asked.clock) marks[MASS_BY_CLOCK] = true;
      window.history.replaceState({ ...window.history.state, ...marks }, "");
    }
    const state = window.history.state ?? {};
    const asksForToday = enabled || state[FOLLOWS_TODAY] === true;
    let target: string | null = null;
    let byClock = false;
    if (asksForToday && today !== renderedDate) {
      // Whatever else the visitor asked for stays: the Vigil stays the Vigil. The clock's
      // evening Mass was the afternoon's, so the new day decides for itself.
      const others = new URLSearchParams(window.location.search);
      others.delete("date");
      if (state[MASS_BY_CLOCK] === true) others.delete("mass");
      const rest = others.toString();
      target = `/liturgy/readings?date=${today}${rest ? `&${rest}` : ""}`;
    } else if (today === renderedDate && evening && eveningHref && !massChosen) {
      target = eveningHref;
      byClock = true;
    }
    // A device set outside the calendar's years would otherwise reload for ever.
    if (!target || address() === target) return;
    writeAsked({ to: target, today: asksForToday, clock: byClock });
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
  }, [enabled, eveningHref, evening, massChosen, renderedDate, router, today]);
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
