import { type NextRequest } from "next/server";

import { listSaintsForFeast } from "@/lib/data/published";

export const dynamic = "force-dynamic";

/**
 * Saints whose feast falls on the given month/day, for the homepage
 * "Today's Feast Day Saints" block. The caller passes its local month/day so
 * the result follows the visitor's timezone. Returns the total plus up to
 * `take` (1–50) saints, foundational figures first.
 *
 * Backed by the indexed feast columns (migration 0054) and memoised for ten
 * minutes per calendar day: this endpoint is hit by every homepage view, and
 * it used to load every saint in the database and parse every payload to
 * answer it.
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

  const matches = await listSaintsForFeast(month, day);
  const items = matches.slice(0, take).map((s) => ({
    slug: s.slug,
    name: s.title,
    biography: typeof s.payload.biography === "string" ? s.payload.biography : undefined,
  }));

  return Response.json(
    { month, day, total: matches.length, items },
    {
      // The feast of a given day is the same for every visitor and changes
      // only when content is published, so it is safe to share and to serve
      // stale while revalidating.
      headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" },
    },
  );
}
