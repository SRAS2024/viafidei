import { type NextRequest } from "next/server";

import { listParishesNear } from "@/lib/data/published";

export const dynamic = "force-dynamic";

/**
 * Parishes nearest a coordinate, for the "use my location" button on
 * /parishes. The page used to receive the whole directory as client props and
 * sort it in the browser; it now ships nothing and asks for the fifty nearest
 * records once the visitor grants geolocation.
 *
 * The coordinate is the visitor's own and is used only to build a bounding box
 * for the query — nothing is stored and nothing is logged.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  // Number(null) is 0, so a missing parameter has to be rejected before the
  // conversion — otherwise "no coordinate" silently becomes the Gulf of Guinea.
  if (rawLat === null || rawLng === null || rawLat.trim() === "" || rawLng.trim() === "") {
    return Response.json({ error: "lat and lng are required" }, { status: 400 });
  }
  const latitude = Number(rawLat);
  const longitude = Number(rawLng);
  const radiusMiles = Number(params.get("radiusMiles") ?? "50");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json({ error: "lat and lng must be numbers" }, { status: 400 });
  }

  try {
    const items = await listParishesNear({
      latitude,
      longitude,
      radiusMiles: Number.isFinite(radiusMiles) ? radiusMiles : 50,
      take: 50,
    });
    return Response.json(
      { items, total: items.length },
      // A location-specific answer: cache in the browser only, never shared.
      { headers: { "cache-control": "private, max-age=60" } },
    );
  } catch {
    // The locator degrades to "no results near you" rather than an error page.
    return Response.json({ items: [], total: 0 });
  }
}
