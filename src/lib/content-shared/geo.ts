/**
 * Geographic helpers for location-aware features (e.g. nearest parish).
 */

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle (haversine) distance in miles between two latitude/longitude
 * points. Accurate enough for "which parish is closest" ranking.
 */
export function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formats a mile distance for display, e.g. "0.4 mi", "12 mi", "1,340 mi". */
export function formatMiles(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles).toLocaleString("en-US")} mi`;
}
