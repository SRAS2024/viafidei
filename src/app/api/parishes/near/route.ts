import { type NextRequest } from "next/server";

import { listParishesNear } from "@/lib/data/published";

export const dynamic = "force-dynamic";

/** The default ask, when the caller does not name a radius. */
const DEFAULT_RADIUS_MILES = 50;
/** `listParishesNear` clamps a bounded search to this. */
const MAX_RADIUS_MILES = 500;
/**
 * The widening ladder. Directory coverage is still sparse — the OSM sweep has
 * reached some regions and not others — so a visitor outside a covered region
 * gets nothing back at fifty miles. Widening beats an unexplained empty list:
 * the response says which radius actually answered so the page can tell the
 * visitor plainly what happened rather than implying there are no parishes
 * near them. `null` is the last rung: nearest records at any distance.
 */
const WIDER_RADII: ReadonlyArray<number | null> = [150, MAX_RADIUS_MILES, null];

const TAKE = 50;

type NearBody = {
  items: unknown[];
  total: number;
  /** The radius the caller asked for, in miles. */
  requestedRadiusMiles: number;
  /** The radius that produced `items`; null when the search was unlimited. */
  radiusMiles: number | null;
  /** True when `radiusMiles` is not what the caller asked for. */
  widened: boolean;
};

function body(payload: NearBody): Response {
  return Response.json(payload, {
    // A location-specific answer: cache in the browser only, never shared.
    headers: { "cache-control": "private, max-age=60" },
  });
}

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

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json({ error: "lat and lng must be numbers" }, { status: 400 });
  }
  // Rejected here rather than deep in the query: an impossible coordinate
  // would otherwise walk the whole ladder to return the same empty list.
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return Response.json({ error: "lat and lng are out of range" }, { status: 400 });
  }

  const rawRadius = Number(params.get("radiusMiles") ?? DEFAULT_RADIUS_MILES);
  const requestedRadiusMiles = Number.isFinite(rawRadius)
    ? Math.min(Math.max(rawRadius, 1), MAX_RADIUS_MILES)
    : DEFAULT_RADIUS_MILES;

  // Only rungs wider than the ask, so a caller who already asked for 500 does
  // not repeat the same query three times before trying the unlimited one.
  const ladder: ReadonlyArray<number | null> = [
    requestedRadiusMiles,
    ...WIDER_RADII.filter((r) => r === null || r > requestedRadiusMiles),
  ];

  try {
    for (const radiusMiles of ladder) {
      const items = await listParishesNear({ latitude, longitude, radiusMiles, take: TAKE });
      if (items.length > 0) {
        return body({
          items,
          total: items.length,
          requestedRadiusMiles,
          radiusMiles,
          widened: radiusMiles !== requestedRadiusMiles,
        });
      }
    }
  } catch {
    // The locator degrades to "no results near you" rather than an error page.
  }

  // Nothing anywhere: an empty directory, or a database that would not answer.
  return body({
    items: [],
    total: 0,
    requestedRadiusMiles,
    radiusMiles: requestedRadiusMiles,
    widened: false,
  });
}
