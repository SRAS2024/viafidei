import { type NextRequest } from "next/server";

import { compareSaintsChronologically } from "@/lib/content-shared/saints";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";

/**
 * Saints whose feast falls on the given month/day, for the homepage
 * "Today's Feast Day Saints" block. The caller passes its local month/day so
 * the result follows the visitor's timezone. Returns the total plus up to
 * `take` (1–50) saints, foundational figures first.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const month = Number(params.get("month"));
  const day = Number(params.get("day"));
  const takeRaw = Number(params.get("take") ?? "5");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(1, Math.trunc(takeRaw)), 50) : 5;

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    return Response.json({ month, day, total: 0, items: [] });
  }

  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const saints = await listPublished("SAINT");
  const matches = saints
    .filter((s) => {
      if (typeof s.payload.feastDay === "string" && s.payload.feastDay === mmdd) return true;
      return Number(s.payload.feastMonth) === month && Number(s.payload.feastDayOfMonth) === day;
    })
    .sort(compareSaintsChronologically);

  const items = matches.slice(0, take).map((s) => ({
    slug: s.slug,
    name: s.title,
    biography: typeof s.payload.biography === "string" ? s.payload.biography : undefined,
  }));

  return Response.json({ month, day, total: matches.length, items });
}
