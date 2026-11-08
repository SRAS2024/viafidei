import { type NextRequest } from "next/server";

import { loadReadingsView } from "@/app/liturgy/readings/load-readings";
import { calendarFromParam } from "@/app/liturgy/readings/readings-view";
import { parseCivilDate } from "@/lib/content-shared/liturgical-calendar";

export const dynamic = "force-dynamic";

/** A formulary key as the tables write one ("night", "extended-vigil", "year-a"). */
const VARIANT_RE = /^[a-z][a-z-]{0,39}$/;

/**
 * One Mass's readings for a date, for the liturgical calendar, which shows them under
 * the day it describes. The Lectionary and the Scripture text are too large to send to
 * a browser, so the calendar asks here for the one Mass it shows, with the same
 * parameters as the readings page (?date, ?mass=vigil|day, ?variant, ?ascension), and
 * gets what that page would show.
 *
 * ?prefer=evening is the visitor's afternoon on their current day: with no Mass named,
 * a date that has an evening Mass beside its own answers with the evening's.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const date = parseCivilDate(params.get("date") ?? undefined);
  if (!date) {
    return Response.json({ error: "A date the calendar covers is required." }, { status: 400 });
  }
  const mass = params.get("mass");
  const variant = params.get("variant");
  const view = await loadReadingsView(date, {
    mass: mass === "vigil" || mass === "day" ? mass : null,
    variant: variant && VARIANT_RE.test(variant) ? variant : null,
    calendar: calendarFromParam(params.get("ascension") ?? undefined),
    preferEvening: params.get("prefer") === "evening",
  });
  return Response.json(view, {
    // A date's readings are the same for every visitor and change only when a stored
    // row is published or corrected, so they are safe to share and to serve stale.
    headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
