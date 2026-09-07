import { type NextRequest } from "next/server";

import { suggestPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";

/**
 * Public autocomplete for the header search. Returns up to `limit` (1–5)
 * suggestions per content group, matched against published title/slug across
 * every content type. The header debounces and only calls this for queries
 * of two or more characters.
 *
 * Every group that has a match now contributes its own best rows (the query
 * asks each content type separately), so a query like "mar" no longer returns
 * only saints and parishes.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const limitRaw = Number(params.get("limit") ?? "3");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.trunc(limitRaw)), 5) : 3;
  try {
    const suggestions = await suggestPublished(q, limit);
    return Response.json(
      { suggestions },
      {
        // The same query returns the same rows for everyone until content is
        // published; a minute of shared caching absorbs typing bursts.
        headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
      },
    );
  } catch {
    // Never let the header search crash; an empty list degrades gracefully.
    return Response.json({ suggestions: [] });
  }
}
