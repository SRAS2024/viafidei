import { type NextRequest } from "next/server";

import { prayerOfTheDay } from "@/lib/data/prayer-of-the-day";

export const dynamic = "force-dynamic";

/**
 * The prayer of the day for the visitor's LOCAL calendar date (passed as
 * `?date=YYYY-MM-DD` from the homepage block, exactly like the feast-day
 * saints), so it follows the visitor's timezone and cycles at their midnight.
 * Deterministic: every visitor sees the same prayer on the same date, and it
 * needs no worker to be running — two small indexed queries per call.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("date") ?? "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  try {
    const prayer = await prayerOfTheDay(iso);
    return Response.json({ date: iso, prayer });
  } catch {
    return Response.json({ date: iso, prayer: null });
  }
}
