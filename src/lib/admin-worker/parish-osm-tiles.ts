/**
 * Persistent tile-grid sweep for OpenStreetMap parish discovery.
 *
 * The old lane rotated through 35 hard-coded bounding boxes and, once each
 * had yielded its first 500 elements, re-scanned them forever for nothing.
 * This module replaces that with a deterministic, resumable sweep of the
 * Catholic world:
 *
 *   - A curated table of country/region bounding boxes (CATHOLIC_REGIONS) is
 *     cut into integer-degree tiles (1° where parishes are dense and OSM is
 *     well tagged, 2° where they are sparse). The existing seed metros come
 *     first so growth continues immediately where it was already working.
 *   - Each tile's state lives in one AdminWorkerMemory row keyed
 *     `osm-tile:<id>` (status, elementCount, lastSweptAt, nextDueAt, …). No
 *     new Prisma table or migration.
 *   - A tile whose query comes back at the Overpass element cap is DENSE: it
 *     is quartered (quadtree) and its children are queued ahead of the
 *     catalogue so no element is ever silently truncated.
 *   - Swept tiles come due again quarterly (`nextDueAt`) so newly mapped
 *     churches are picked up; empty tiles wait longer; failed tiles retry
 *     with a growing backoff.
 *
 * Selection is a cursor over the deterministic catalogue plus a LIFO queue of
 * split children — a bounded number of small memory reads per run, never a
 * scan of every tile. Everything is fail-open: a memory glitch yields "no
 * tile this run", never a wedged lane.
 */

import type { PrismaClient } from "@prisma/client";

/** [south, west, north, east] in degrees. */
export type BBox = [number, number, number, number];

export type OsmTileStatus = "PENDING" | "IN_PROGRESS" | "SWEPT" | "DENSE_SPLIT" | "FAILED";

export interface OsmTile {
  id: string;
  bbox: BBox;
  /** Human label of the region the tile was cut from (also the country
   * fallback for elements without `addr:country`). */
  country: string;
  /** ISO-3166 alpha-2 when the region is a single country. */
  countryCode?: string;
  /** Tile edge in degrees (1, 2, or a quadtree fraction of those). */
  deg: number;
}

export interface OsmTileState {
  status: OsmTileStatus;
  elementCount: number;
  accepted: number;
  published: number;
  lastSweptAt: number | null;
  nextDueAt: number | null;
  /** `type/id` of the last element fully processed when a run stopped early
   * (publish cap / deadline); the next visit resumes after it. */
  resumeAfter: string | null;
  failures: number;
  lastError: string | null;
}

interface Region {
  name: string;
  countryCode?: string;
  bbox: BBox;
  /** Tile edge in degrees; 1 for dense/well-mapped areas, 2 for sparse ones. */
  deg?: 1 | 2;
}

/**
 * Seed metros — the boxes the lane was already sweeping. Kept as their own
 * tiles at the head of the catalogue so the directory keeps growing in the
 * places that were working while the world grid fills in behind them.
 */
const SEED_METROS: Array<{ name: string; countryCode: string; bbox: BBox }> = [
  { name: "Rome", countryCode: "IT", bbox: [41.79, 12.34, 42.0, 12.65] },
  { name: "Boston", countryCode: "US", bbox: [42.2, -71.2, 42.45, -70.95] },
  { name: "New York", countryCode: "US", bbox: [40.5, -74.05, 40.92, -73.7] },
  { name: "Chicago", countryCode: "US", bbox: [41.64, -87.94, 42.02, -87.52] },
  { name: "Philadelphia", countryCode: "US", bbox: [39.87, -75.28, 40.14, -74.96] },
  { name: "Los Angeles", countryCode: "US", bbox: [33.7, -118.5, 34.34, -118.15] },
  { name: "Dublin", countryCode: "IE", bbox: [53.28, -6.4, 53.41, -6.1] },
  { name: "Manila", countryCode: "PH", bbox: [14.5, 120.94, 14.68, 121.05] },
  { name: "Kraków", countryCode: "PL", bbox: [49.98, 19.79, 50.12, 20.09] },
  { name: "Warsaw", countryCode: "PL", bbox: [52.13, 20.85, 52.37, 21.27] },
  { name: "Madrid", countryCode: "ES", bbox: [40.31, -3.83, 40.56, -3.55] },
  { name: "Paris", countryCode: "FR", bbox: [48.8, 2.22, 48.91, 2.47] },
  { name: "Milan", countryCode: "IT", bbox: [45.4, 9.07, 45.54, 9.28] },
  { name: "Naples", countryCode: "IT", bbox: [40.8, 14.14, 40.92, 14.34] },
  { name: "Lisbon", countryCode: "PT", bbox: [38.69, -9.23, 38.8, -9.09] },
  { name: "Vienna", countryCode: "AT", bbox: [48.12, 16.24, 48.32, 16.51] },
  { name: "Munich", countryCode: "DE", bbox: [48.06, 11.36, 48.25, 11.72] },
  { name: "Buenos Aires", countryCode: "AR", bbox: [-34.71, -58.53, -34.53, -58.33] },
  { name: "Mexico City", countryCode: "MX", bbox: [19.24, -99.28, 19.59, -98.94] },
  { name: "São Paulo", countryCode: "BR", bbox: [-23.75, -46.83, -23.43, -46.36] },
  { name: "Montreal", countryCode: "CA", bbox: [45.4, -73.77, 45.7, -73.47] },
  { name: "Toronto", countryCode: "CA", bbox: [43.58, -79.64, 43.85, -79.12] },
  { name: "Sydney", countryCode: "AU", bbox: [-33.95, 151.1, -33.78, 151.3] },
  { name: "Malta", countryCode: "MT", bbox: [35.79, 14.18, 36.08, 14.58] },
];

/**
 * Country/region boxes covering where Catholic parishes exist, in sweep
 * order: the densest, best-mapped areas first (they yield the most per
 * query), then the wider Catholic world. Boxes may overlap — tiles snap to
 * the integer grid and identical ids collapse, so overlap costs nothing.
 * Coarse boxes deliberately include some sea/desert: an empty tile is one
 * cheap query that is then parked for months.
 */
export const CATHOLIC_REGIONS: Region[] = [
  // ── Western/Central Europe (dense, superbly mapped) ───────────────────────
  { name: "Ireland", countryCode: "IE", bbox: [51.4, -10.6, 55.4, -5.4] },
  { name: "Belgium", countryCode: "BE", bbox: [49.5, 2.5, 51.5, 6.4] },
  { name: "Netherlands", countryCode: "NL", bbox: [50.75, 3.35, 53.5, 7.2] },
  { name: "Austria", countryCode: "AT", bbox: [46.4, 9.5, 49.0, 17.2] },
  { name: "Switzerland", countryCode: "CH", bbox: [45.8, 5.95, 47.8, 10.5] },
  { name: "Portugal", countryCode: "PT", bbox: [37.0, -9.5, 42.15, -6.2] },
  { name: "Spain", countryCode: "ES", bbox: [36.0, -9.3, 43.8, 3.35] },
  { name: "Slovenia", countryCode: "SI", bbox: [45.42, 13.38, 46.88, 16.6] },
  { name: "Croatia", countryCode: "HR", bbox: [42.4, 13.5, 46.55, 19.45] },
  { name: "Slovakia", countryCode: "SK", bbox: [47.7, 16.8, 49.6, 22.6] },
  { name: "Italy", countryCode: "IT", bbox: [36.6, 6.6, 47.1, 18.6] },
  { name: "France", countryCode: "FR", bbox: [42.3, -5.2, 51.1, 8.3] },
  { name: "Poland", countryCode: "PL", bbox: [49.0, 14.1, 54.9, 24.2] },
  { name: "Germany", countryCode: "DE", bbox: [47.2, 5.9, 55.1, 15.1] },
  { name: "Luxembourg", countryCode: "LU", bbox: [49.4, 5.7, 50.2, 6.6] },
  { name: "Czechia", countryCode: "CZ", bbox: [48.5, 12.0, 51.1, 18.9] },
  { name: "Hungary", countryCode: "HU", bbox: [45.7, 16.1, 48.6, 22.9] },
  { name: "Lithuania", countryCode: "LT", bbox: [53.9, 20.9, 56.5, 26.9] },
  { name: "United Kingdom", countryCode: "GB", bbox: [49.9, -8.2, 58.7, 1.8] },
  { name: "Malta", countryCode: "MT", bbox: [35.7, 14.1, 36.1, 14.6] },
  { name: "Andorra & Monaco", bbox: [42.4, 1.4, 43.8, 7.5] },
  // ── The Americas ──────────────────────────────────────────────────────────
  { name: "United States (East)", countryCode: "US", bbox: [24.5, -95.0, 49.4, -66.9] },
  { name: "United States (West)", countryCode: "US", bbox: [31.3, -124.8, 49.0, -95.0], deg: 2 },
  { name: "Puerto Rico & USVI", countryCode: "PR", bbox: [17.8, -67.4, 18.6, -64.5] },
  { name: "Canada (South)", countryCode: "CA", bbox: [41.7, -141.0, 55.0, -52.6], deg: 2 },
  { name: "Mexico", countryCode: "MX", bbox: [14.5, -117.2, 32.8, -86.7] },
  { name: "Brazil", countryCode: "BR", bbox: [-33.8, -74.0, 5.3, -34.8], deg: 2 },
  { name: "Argentina", countryCode: "AR", bbox: [-55.1, -73.6, -21.8, -53.6], deg: 2 },
  { name: "Colombia", countryCode: "CO", bbox: [-4.3, -79.1, 12.5, -66.8] },
  { name: "Peru", countryCode: "PE", bbox: [-18.4, -81.4, -0.0, -68.6], deg: 2 },
  { name: "Chile", countryCode: "CL", bbox: [-55.9, -75.7, -17.5, -66.4], deg: 2 },
  { name: "Venezuela", countryCode: "VE", bbox: [0.6, -73.4, 12.2, -59.8], deg: 2 },
  { name: "Ecuador", countryCode: "EC", bbox: [-5.0, -81.1, 1.7, -75.2] },
  { name: "Bolivia", countryCode: "BO", bbox: [-22.9, -69.7, -9.7, -57.4], deg: 2 },
  { name: "Paraguay", countryCode: "PY", bbox: [-27.6, -62.7, -19.3, -54.2], deg: 2 },
  { name: "Uruguay", countryCode: "UY", bbox: [-35.0, -58.5, -30.1, -53.1] },
  { name: "Guatemala", countryCode: "GT", bbox: [13.7, -92.3, 17.9, -88.2] },
  { name: "Honduras & El Salvador", bbox: [13.1, -90.2, 16.1, -83.1] },
  { name: "Nicaragua", countryCode: "NI", bbox: [10.7, -87.7, 15.1, -82.7] },
  { name: "Costa Rica", countryCode: "CR", bbox: [8.0, -86.0, 11.3, -82.5] },
  { name: "Panama", countryCode: "PA", bbox: [7.2, -83.1, 9.7, -77.1] },
  { name: "Cuba", countryCode: "CU", bbox: [19.8, -85.0, 23.3, -74.1] },
  { name: "Dominican Republic & Haiti", bbox: [17.5, -74.5, 20.0, -68.3] },
  { name: "Jamaica & Caribbean", bbox: [10.0, -78.5, 18.6, -59.4], deg: 2 },
  { name: "Guyana, Suriname & French Guiana", bbox: [1.2, -61.5, 8.6, -51.6], deg: 2 },
  // ── Philippines, East Timor, Asia-Pacific ─────────────────────────────────
  { name: "Philippines", countryCode: "PH", bbox: [4.5, 116.9, 21.2, 126.7] },
  { name: "East Timor", countryCode: "TL", bbox: [-9.6, 124.0, -8.1, 127.4] },
  { name: "Indonesia (Flores & NTT)", countryCode: "ID", bbox: [-11.0, 118.9, -8.0, 125.2] },
  { name: "Indonesia", countryCode: "ID", bbox: [-11.0, 95.0, 6.0, 141.0], deg: 2 },
  { name: "Papua New Guinea", countryCode: "PG", bbox: [-11.7, 140.8, -1.3, 156.0], deg: 2 },
  { name: "South Korea", countryCode: "KR", bbox: [33.1, 125.0, 38.7, 129.6] },
  { name: "Japan", countryCode: "JP", bbox: [24.0, 122.9, 45.6, 145.9], deg: 2 },
  { name: "Vietnam", countryCode: "VN", bbox: [8.4, 102.1, 23.4, 109.5] },
  { name: "Taiwan", countryCode: "TW", bbox: [21.9, 120.0, 25.4, 122.0] },
  { name: "Hong Kong & Macau", bbox: [22.1, 113.5, 22.6, 114.5] },
  { name: "Malaysia & Singapore", bbox: [0.8, 99.6, 7.4, 119.3], deg: 2 },
  { name: "Thailand", countryCode: "TH", bbox: [5.6, 97.3, 20.5, 105.7], deg: 2 },
  { name: "Cambodia & Laos", bbox: [10.4, 100.0, 22.5, 107.7], deg: 2 },
  { name: "Myanmar", countryCode: "MM", bbox: [9.6, 92.2, 28.5, 101.2], deg: 2 },
  { name: "China (East)", countryCode: "CN", bbox: [18.1, 100.0, 42.0, 122.2], deg: 2 },
  { name: "Mongolia", countryCode: "MN", bbox: [47.5, 106.0, 48.2, 107.5] },
  // ── India / South Asia ────────────────────────────────────────────────────
  { name: "Kerala", countryCode: "IN", bbox: [8.2, 74.8, 12.8, 77.4] },
  { name: "Goa", countryCode: "IN", bbox: [14.8, 73.6, 15.9, 74.4] },
  { name: "Tamil Nadu", countryCode: "IN", bbox: [8.0, 76.2, 13.6, 80.4] },
  { name: "Maharashtra & Karnataka coast", countryCode: "IN", bbox: [12.5, 72.6, 20.2, 75.5] },
  { name: "North-East India", countryCode: "IN", bbox: [21.9, 88.0, 29.5, 97.4], deg: 2 },
  { name: "India", countryCode: "IN", bbox: [6.5, 68.0, 35.5, 97.4], deg: 2 },
  { name: "Sri Lanka", countryCode: "LK", bbox: [5.9, 79.6, 9.9, 81.9] },
  { name: "Pakistan", countryCode: "PK", bbox: [23.6, 60.8, 37.1, 77.8], deg: 2 },
  { name: "Bangladesh", countryCode: "BD", bbox: [20.7, 88.0, 26.7, 92.7], deg: 2 },
  { name: "Nepal", countryCode: "NP", bbox: [26.3, 80.0, 30.5, 88.2], deg: 2 },
  // ── Oceania ───────────────────────────────────────────────────────────────
  { name: "Australia", countryCode: "AU", bbox: [-43.7, 112.9, -10.6, 153.7], deg: 2 },
  { name: "New Zealand", countryCode: "NZ", bbox: [-47.3, 166.4, -34.3, 178.6], deg: 2 },
  { name: "Fiji, Samoa, Tonga & Vanuatu", bbox: [-21.5, 166.0, -12.5, 180.0], deg: 2 },
  { name: "Samoa & American Samoa", bbox: [-14.4, -172.9, -13.4, -170.5] },
  { name: "Solomon Islands", countryCode: "SB", bbox: [-12.3, 155.5, -5.0, 170.3], deg: 2 },
  { name: "Guam & Micronesia", bbox: [1.0, 138.0, 20.0, 163.0], deg: 2 },
  { name: "New Caledonia & French Polynesia", bbox: [-23.0, 163.0, -19.0, 168.5] },
  { name: "Tahiti", countryCode: "PF", bbox: [-18.0, -150.0, -16.5, -149.0] },
  { name: "Kiribati & Nauru", bbox: [-1.0, 166.0, 4.0, 174.0], deg: 2 },
  // ── Eastern Europe, Baltics, Balkans, Nordics ─────────────────────────────
  { name: "Ukraine", countryCode: "UA", bbox: [44.3, 22.1, 52.4, 40.3], deg: 2 },
  { name: "Belarus", countryCode: "BY", bbox: [51.2, 23.1, 56.2, 32.8], deg: 2 },
  { name: "Latvia", countryCode: "LV", bbox: [55.6, 20.9, 58.1, 28.3] },
  { name: "Estonia", countryCode: "EE", bbox: [57.5, 21.7, 59.7, 28.2], deg: 2 },
  { name: "Romania", countryCode: "RO", bbox: [43.6, 20.2, 48.3, 29.8] },
  { name: "Moldova", countryCode: "MD", bbox: [45.4, 26.6, 48.5, 30.2] },
  { name: "Bulgaria", countryCode: "BG", bbox: [41.2, 22.3, 44.3, 28.7], deg: 2 },
  { name: "Serbia & Montenegro", bbox: [41.8, 18.4, 46.2, 23.1] },
  { name: "Bosnia and Herzegovina", countryCode: "BA", bbox: [42.5, 15.7, 45.3, 19.7] },
  { name: "Albania, Kosovo & North Macedonia", bbox: [39.6, 19.2, 43.3, 23.1] },
  { name: "Greece", countryCode: "GR", bbox: [34.8, 19.3, 41.8, 28.3], deg: 2 },
  { name: "Cyprus", countryCode: "CY", bbox: [34.5, 32.2, 35.8, 34.7] },
  { name: "Denmark", countryCode: "DK", bbox: [54.5, 8.0, 57.8, 12.7] },
  { name: "Norway (South)", countryCode: "NO", bbox: [57.9, 4.6, 64.0, 13.0], deg: 2 },
  { name: "Sweden (South)", countryCode: "SE", bbox: [55.3, 11.0, 61.0, 19.0], deg: 2 },
  { name: "Finland (South)", countryCode: "FI", bbox: [59.7, 20.5, 63.0, 30.5], deg: 2 },
  { name: "Iceland", countryCode: "IS", bbox: [63.3, -24.6, 66.6, -13.4], deg: 2 },
  { name: "Russia (European)", countryCode: "RU", bbox: [43.0, 27.3, 61.0, 50.0], deg: 2 },
  { name: "Georgia & Armenia", bbox: [38.8, 40.0, 43.6, 46.8], deg: 2 },
  { name: "Kazakhstan (South)", countryCode: "KZ", bbox: [40.5, 50.0, 53.0, 80.0], deg: 2 },
  // ── Lebanon / Middle East / North Africa ──────────────────────────────────
  { name: "Lebanon", countryCode: "LB", bbox: [33.0, 35.1, 34.7, 36.7] },
  { name: "Israel & Palestine", bbox: [29.4, 34.2, 33.4, 35.9] },
  { name: "Jordan", countryCode: "JO", bbox: [29.1, 34.9, 33.4, 39.4], deg: 2 },
  { name: "Syria", countryCode: "SY", bbox: [32.3, 35.7, 37.4, 42.4], deg: 2 },
  { name: "Iraq", countryCode: "IQ", bbox: [29.0, 38.7, 37.4, 48.7], deg: 2 },
  { name: "Egypt", countryCode: "EG", bbox: [22.0, 24.6, 31.8, 36.9], deg: 2 },
  { name: "Turkey", countryCode: "TR", bbox: [35.8, 25.6, 42.2, 44.9], deg: 2 },
  { name: "Arabian Gulf", bbox: [22.5, 46.5, 30.2, 56.5], deg: 2 },
  { name: "Iran", countryCode: "IR", bbox: [25.0, 44.0, 39.8, 63.4], deg: 2 },
  { name: "Morocco, Algeria & Tunisia (coast)", bbox: [30.0, -11.0, 37.6, 11.8], deg: 2 },
  { name: "Libya (coast)", countryCode: "LY", bbox: [30.0, 9.3, 33.3, 25.2], deg: 2 },
  // ── Sub-Saharan Africa ────────────────────────────────────────────────────
  { name: "Nigeria", countryCode: "NG", bbox: [4.2, 2.6, 13.9, 14.7] },
  { name: "DR Congo", countryCode: "CD", bbox: [-13.5, 12.1, 5.4, 31.4], deg: 2 },
  { name: "Uganda", countryCode: "UG", bbox: [-1.5, 29.5, 4.3, 35.1] },
  { name: "Kenya", countryCode: "KE", bbox: [-4.7, 33.9, 5.1, 41.9], deg: 2 },
  { name: "Tanzania", countryCode: "TZ", bbox: [-11.8, 29.3, -0.9, 40.5], deg: 2 },
  { name: "Rwanda & Burundi", bbox: [-4.5, 28.8, -1.0, 31.0] },
  { name: "Angola", countryCode: "AO", bbox: [-18.1, 11.6, -4.3, 24.1], deg: 2 },
  { name: "Mozambique", countryCode: "MZ", bbox: [-26.9, 30.2, -10.4, 40.9], deg: 2 },
  { name: "Zambia & Malawi", bbox: [-18.1, 21.9, -8.2, 36.0], deg: 2 },
  { name: "Zimbabwe", countryCode: "ZW", bbox: [-22.5, 25.2, -15.6, 33.1], deg: 2 },
  { name: "South Africa, Lesotho & Eswatini", bbox: [-35.0, 16.4, -22.1, 33.0], deg: 2 },
  { name: "Namibia & Botswana", bbox: [-29.0, 11.7, -17.0, 29.4], deg: 2 },
  { name: "Cameroon", countryCode: "CM", bbox: [1.6, 8.4, 13.1, 16.2], deg: 2 },
  { name: "Gabon, Congo & Equatorial Guinea", bbox: [-5.1, 8.7, 3.8, 18.7], deg: 2 },
  { name: "Central African Republic & Chad (South)", bbox: [2.2, 13.0, 12.0, 27.5], deg: 2 },
  { name: "Ghana", countryCode: "GH", bbox: [4.7, -3.3, 11.2, 1.2] },
  { name: "Ivory Coast", countryCode: "CI", bbox: [4.3, -8.6, 10.8, -2.5], deg: 2 },
  { name: "Benin & Togo", bbox: [6.1, 0.7, 12.4, 3.9] },
  { name: "Burkina Faso", countryCode: "BF", bbox: [9.4, -5.6, 15.1, 2.4], deg: 2 },
  { name: "Senegal, Gambia & Guinea-Bissau", bbox: [10.9, -17.6, 16.7, -11.3], deg: 2 },
  { name: "Guinea, Sierra Leone & Liberia", bbox: [4.3, -15.1, 12.7, -7.3], deg: 2 },
  { name: "Mali & Niger (South)", bbox: [10.1, -12.3, 17.0, 16.0], deg: 2 },
  { name: "Ethiopia & Eritrea", bbox: [3.4, 33.0, 18.0, 48.0], deg: 2 },
  { name: "South Sudan & Sudan (South)", bbox: [3.5, 24.1, 15.7, 36.0], deg: 2 },
  { name: "Madagascar", countryCode: "MG", bbox: [-25.7, 43.2, -11.9, 50.5], deg: 2 },
  { name: "Mauritius, Réunion & Seychelles", bbox: [-21.5, 55.0, -4.2, 63.6], deg: 2 },
  { name: "Cape Verde & São Tomé", bbox: [0.0, -25.4, 17.3, 7.5], deg: 2 },
];

/** Minimum tile edge — below this the quadtree stops and accepts the cap. */
export const MIN_TILE_DEG = 1 / 16;

function fmt(n: number): string {
  // Stable, compact id fragments: "41", "12.5", "-71.25".
  return Number(n.toFixed(4)).toString();
}

export function tileId(deg: number, south: number, west: number): string {
  return `t:${fmt(deg)}:${fmt(south)}:${fmt(west)}`;
}

/** Parse a grid tile id back into its bbox (null for seed-metro ids). */
export function parseTileId(id: string): { deg: number; bbox: BBox } | null {
  const m = /^t:(-?[\d.]+):(-?[\d.]+):(-?[\d.]+)$/.exec(id);
  if (!m) return null;
  const deg = Number(m[1]);
  const s = Number(m[2]);
  const w = Number(m[3]);
  if (![deg, s, w].every(Number.isFinite) || deg <= 0) return null;
  return { deg, bbox: [s, w, s + deg, w + deg] };
}

/** Cut a region box into grid-aligned tiles of `deg` degrees. */
function tilesFor(region: Region): OsmTile[] {
  const deg = region.deg ?? 1;
  const [s, w, n, e] = region.bbox;
  const out: OsmTile[] = [];
  const south0 = Math.floor(s / deg) * deg;
  const west0 = Math.floor(w / deg) * deg;
  for (let lat = south0; lat < n; lat += deg) {
    for (let lon = west0; lon < e; lon += deg) {
      if (lat < -90 || lat + deg > 90) continue;
      out.push({
        id: tileId(deg, lat, lon),
        bbox: [lat, lon, lat + deg, lon + deg],
        country: region.name,
        countryCode: region.countryCode,
        deg,
      });
    }
  }
  return out;
}

let catalogueCache: OsmTile[] | null = null;

/**
 * The full deterministic sweep order: seed metros, then every region tile.
 * Duplicate grid ids (overlapping regions) keep their first occurrence.
 */
export function osmTileCatalogue(): OsmTile[] {
  if (catalogueCache) return catalogueCache;
  const seen = new Set<string>();
  const out: OsmTile[] = [];
  for (const m of SEED_METROS) {
    const id = `m:${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const [s, w, n, e] = m.bbox;
    out.push({
      id,
      bbox: m.bbox,
      country: m.name,
      countryCode: m.countryCode,
      deg: Math.max(n - s, e - w),
    });
  }
  for (const region of CATHOLIC_REGIONS) {
    for (const t of tilesFor(region)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  catalogueCache = out;
  return out;
}

/** Quarter a tile (quadtree). Returns [] once the minimum size is reached. */
export function splitTile(tile: OsmTile): OsmTile[] {
  const half = tile.deg / 2;
  if (half < MIN_TILE_DEG) return [];
  const [s, w] = tile.bbox;
  // Seed metros are not grid-aligned; their children are cut from their own
  // corner instead of the grid, which the id encodes exactly the same way.
  const kids: OsmTile[] = [];
  for (const [ds, dw] of [
    [0, 0],
    [0, half],
    [half, 0],
    [half, half],
  ] as const) {
    const lat = s + ds;
    const lon = w + dw;
    kids.push({
      id: tileId(half, lat, lon),
      bbox: [lat, lon, lat + half, lon + half],
      country: tile.country,
      countryCode: tile.countryCode,
      deg: half,
    });
  }
  return kids;
}

// ── Persistence (AdminWorkerMemory, GENERIC) ────────────────────────────────

const TILE_PREFIX = "osm-tile:";
const CURSOR_KEY = "osm-tile-cursor";
const QUEUE_KEY = "osm-tile-queue";
/** Tiles a run stopped inside (publish cap / deadline): resumed first next run. */
const ACTIVE_KEY = "osm-tile-active";

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Swept tiles come due again after this (quarterly by default). */
export function resweepMs(): number {
  return envInt("ADMIN_WORKER_OSM_RESWEEP_DAYS", 90) * DAY_MS;
}
/** Empty tiles (no Catholic churches mapped) wait longer. */
export function emptyResweepMs(): number {
  return envInt("ADMIN_WORKER_OSM_EMPTY_RESWEEP_DAYS", 180) * DAY_MS;
}
/** How many catalogue rows the cursor may inspect per run looking for a due tile. */
const MAX_SCAN_PER_RUN = 200;

export function freshTileState(): OsmTileState {
  return {
    status: "PENDING",
    elementCount: 0,
    accepted: 0,
    published: 0,
    lastSweptAt: null,
    nextDueAt: null,
    resumeAfter: null,
    failures: 0,
    lastError: null,
  };
}

async function readJson<T>(prisma: PrismaClient, key: string): Promise<T | null> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null;
}

async function writeJson(
  prisma: PrismaClient,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: key } },
      update: { memoryValue: value as never, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: key,
        memoryValue: value as never,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

export async function readTileState(
  prisma: PrismaClient,
  id: string,
): Promise<OsmTileState | null> {
  const v = await readJson<Partial<OsmTileState>>(prisma, TILE_PREFIX + id);
  if (!v || typeof v.status !== "string") return null;
  return { ...freshTileState(), ...v } as OsmTileState;
}

/** Read a tile row back as tile + state (the row stores bbox/country/deg). */
export async function readTileRow(
  prisma: PrismaClient,
  id: string,
): Promise<{ tile: OsmTile; state: OsmTileState } | null> {
  const v = await readJson<
    Partial<OsmTileState> & { bbox?: BBox; country?: string; countryCode?: string; deg?: number }
  >(prisma, TILE_PREFIX + id);
  if (!v || typeof v.status !== "string" || !Array.isArray(v.bbox) || v.bbox.length !== 4)
    return null;
  const state = { ...freshTileState(), ...v } as OsmTileState & Record<string, unknown>;
  const { bbox, country, countryCode, deg, ...rest } = state;
  return {
    tile: {
      id,
      bbox: bbox as BBox,
      country: typeof country === "string" ? country : "",
      countryCode: typeof countryCode === "string" ? countryCode : undefined,
      deg: typeof deg === "number" ? deg : (parseTileId(id)?.deg ?? 1),
    },
    state: rest as OsmTileState,
  };
}

async function readActive(prisma: PrismaClient): Promise<string[]> {
  const ids = (await readJson<{ ids?: unknown }>(prisma, ACTIVE_KEY))?.ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}

export async function markTileActive(prisma: PrismaClient, id: string): Promise<void> {
  const ids = await readActive(prisma);
  if (ids.includes(id)) return;
  await writeJson(prisma, ACTIVE_KEY, { ids: [...ids, id] });
}

export async function clearTileActive(prisma: PrismaClient, id: string): Promise<void> {
  const ids = await readActive(prisma);
  if (!ids.includes(id)) return;
  await writeJson(prisma, ACTIVE_KEY, { ids: ids.filter((x) => x !== id) });
}

export async function writeTileState(
  prisma: PrismaClient,
  tile: OsmTile,
  state: OsmTileState,
): Promise<void> {
  await writeJson(prisma, TILE_PREFIX + tile.id, {
    ...state,
    bbox: tile.bbox,
    country: tile.country,
    deg: tile.deg,
  });
}

/** A tile is due when never swept, mid-sweep, or its nextDueAt has passed. */
export function tileIsDue(state: OsmTileState | null, now = Date.now()): boolean {
  if (!state) return true;
  if (state.status === "PENDING" || state.status === "IN_PROGRESS") return true;
  if (state.status === "DENSE_SPLIT") return false; // its children are what's due
  return state.nextDueAt != null && state.nextDueAt <= now;
}

interface CursorState {
  pos: number;
  /** Catalogue length the cursor was built for; a changed catalogue restarts. */
  size: number;
  /** When a whole wrap found nothing due, sleep until the earliest nextDueAt. */
  idleUntil: number | null;
  /** Earliest nextDueAt seen during the current wrap. */
  minDueSeen: number | null;
}

interface QueueEntry {
  id: string;
  country: string;
  countryCode?: string;
}

function tileFromQueueEntry(q: QueueEntry): OsmTile | null {
  const parsed = parseTileId(q.id);
  if (!parsed) return null;
  return {
    id: q.id,
    bbox: parsed.bbox,
    country: q.country,
    countryCode: q.countryCode,
    deg: parsed.deg,
  };
}

/** Queue split children ahead of the catalogue (LIFO: drain a dense area fully). */
export async function enqueueTiles(prisma: PrismaClient, tiles: OsmTile[]): Promise<void> {
  if (tiles.length === 0) return;
  const q = (await readJson<{ items?: QueueEntry[] }>(prisma, QUEUE_KEY))?.items ?? [];
  const known = new Set(q.map((e) => e.id));
  for (const t of tiles) {
    if (known.has(t.id)) continue;
    q.push({ id: t.id, country: t.country, countryCode: t.countryCode });
  }
  await writeJson(prisma, QUEUE_KEY, { items: q });
}

export interface ClaimedTile {
  tile: OsmTile;
  state: OsmTileState;
}

/**
 * Pick up to `max` due tiles for this run. Split children (queue) come first;
 * otherwise the cursor walks the catalogue, expanding DENSE_SPLIT parents into
 * their children and skipping tiles that are not yet due. Bounded to a few
 * hundred small reads per run; when a full wrap finds nothing due the sweep
 * sleeps until the earliest nextDueAt.
 */
export async function claimDueTiles(
  prisma: PrismaClient,
  max: number,
  now = Date.now(),
): Promise<{ tiles: ClaimedTile[]; detail: string }> {
  const catalogue = osmTileCatalogue();
  const out: ClaimedTile[] = [];

  // 0. Tiles a previous run stopped inside resume first (their state carries
  //    `resumeAfter`), so a capped run never leaves half a tile behind.
  const active = await readActive(prisma);
  if (active.length > 0) {
    const keep: string[] = [];
    for (const id of active) {
      const row = await readTileRow(prisma, id);
      if (row?.state.status === "IN_PROGRESS") {
        keep.push(id);
        if (out.length < max) out.push(row);
      }
    }
    if (keep.length !== active.length) await writeJson(prisma, ACTIVE_KEY, { ids: keep });
    if (out.length >= max) return { tiles: out, detail: `${out.length} resumed tile(s)` };
  }

  const queue = (await readJson<{ items?: QueueEntry[] }>(prisma, QUEUE_KEY))?.items ?? [];
  let queueDirty = false;

  // 1. Split children first.
  while (out.length < max && queue.length > 0) {
    const entry = queue.pop()!;
    queueDirty = true;
    const tile = tileFromQueueEntry(entry);
    if (!tile) continue;
    const state = await readTileState(prisma, tile.id);
    if (state?.status === "DENSE_SPLIT") {
      for (const kid of splitTile(tile))
        queue.push({ id: kid.id, country: kid.country, countryCode: kid.countryCode });
      continue;
    }
    if (tileIsDue(state, now)) out.push({ tile, state: state ?? freshTileState() });
  }
  if (queueDirty) await writeJson(prisma, QUEUE_KEY, { items: queue });
  if (out.length >= max) return { tiles: out, detail: `${out.length} queued split tile(s)` };

  // 2. Catalogue cursor.
  const saved = await readJson<Partial<CursorState>>(prisma, CURSOR_KEY);
  const cursor: CursorState = {
    pos: typeof saved?.pos === "number" && saved.size === catalogue.length ? saved.pos : 0,
    size: catalogue.length,
    idleUntil: typeof saved?.idleUntil === "number" ? saved.idleUntil : null,
    minDueSeen:
      typeof saved?.minDueSeen === "number" && saved.size === catalogue.length
        ? saved.minDueSeen
        : null,
  };
  if (cursor.idleUntil != null && cursor.idleUntil > now && out.length === 0) {
    const hours = ((cursor.idleUntil - now) / (60 * 60 * 1000)).toFixed(1);
    return { tiles: out, detail: `every tile swept — next re-sweep due in ~${hours}h` };
  }
  cursor.idleUntil = null;

  let scanned = 0;
  const pendingChildren: OsmTile[] = [];
  while (out.length < max && scanned < MAX_SCAN_PER_RUN) {
    if (cursor.pos >= catalogue.length) {
      // Completed a wrap. If nothing at all was due, park until the earliest
      // known nextDueAt instead of scanning every tile again every run.
      cursor.pos = 0;
      if (out.length === 0 && pendingChildren.length === 0 && scanned > 0 && cursor.minDueSeen) {
        cursor.idleUntil = cursor.minDueSeen;
        cursor.minDueSeen = null;
        break;
      }
      cursor.minDueSeen = null;
    }
    const tile = catalogue[cursor.pos]!;
    cursor.pos += 1;
    scanned += 1;
    const state = await readTileState(prisma, tile.id);
    if (state?.status === "DENSE_SPLIT") {
      pendingChildren.push(...splitTile(tile));
      if (pendingChildren.length > 0) break; // drain them (via the queue) before moving on
      continue;
    }
    if (tileIsDue(state, now)) {
      out.push({ tile, state: state ?? freshTileState() });
    } else if (state?.nextDueAt != null) {
      cursor.minDueSeen =
        cursor.minDueSeen == null ? state.nextDueAt : Math.min(cursor.minDueSeen, state.nextDueAt);
    }
  }
  await writeJson(prisma, CURSOR_KEY, { ...cursor });
  if (pendingChildren.length > 0) {
    await enqueueTiles(prisma, pendingChildren);
    // Take from the freshly queued children right away when we still have room.
    if (out.length < max) {
      const more = await claimDueTiles(prisma, max - out.length, now);
      out.push(...more.tiles);
    }
  }
  return {
    tiles: out,
    detail:
      out.length > 0
        ? `${out.length} tile(s) claimed (cursor ${cursor.pos}/${catalogue.length})`
        : `no due tile within ${scanned} catalogue rows (cursor ${cursor.pos}/${catalogue.length})`,
  };
}

/** Coarse progress numbers for logs/dashboards (cheap: cursor + queue only). */
export async function osmTileProgress(
  prisma: PrismaClient,
): Promise<{ catalogue: number; cursor: number; queued: number }> {
  const cursor = await readJson<Partial<CursorState>>(prisma, CURSOR_KEY);
  const queue = (await readJson<{ items?: QueueEntry[] }>(prisma, QUEUE_KEY))?.items ?? [];
  return {
    catalogue: osmTileCatalogue().length,
    cursor: typeof cursor?.pos === "number" ? cursor.pos : 0,
    queued: queue.length,
  };
}
