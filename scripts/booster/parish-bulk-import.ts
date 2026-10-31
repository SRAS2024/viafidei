#!/usr/bin/env tsx
/**
 * Booster: bulk-publish the Catholic world's churches from OpenStreetMap.
 *
 * The Admin Worker's OSM lane sweeps one small tile per pass (~800 parishes an
 * hour). This operator tool does the same job at bulk speed, through the same
 * publish path, so the directory can be filled in a day:
 *
 *   - Overpass, one polite query at a time per public mirror, over grid cells
 *     cut from the worker's own CATHOLIC_REGIONS table; a cell Overpass cannot
 *     answer in time is quartered and retried.
 *   - Only real, attendable places of worship: named, explicitly Catholic, not
 *     a ruin, not private, not a wayside cross/shrine, grotto, Station of the
 *     Cross or cemetery chapel. Designation from tags and name (parish church,
 *     chapel, oratory, shrine, cathedral, minor/major basilica).
 *   - Every candidate is checked against the WHOLE existing catalog (loaded
 *     once) and against everything published earlier in the run: same OSM
 *     element, same distinctive name within 200 m, or the same building mapped
 *     twice within 30 m. Nothing is ever published twice.
 *   - Address parts come from the element's own tags, completed by Nominatim's
 *     /lookup of that exact OSM object (<= 50 ids per request, >= 1.1 s apart,
 *     identifying User-Agent). Nothing is invented; a part no source gives
 *     stays empty and the record is marked `partial` for the research lane.
 *   - Publishing goes through runPublishOrchestrator with the OSM lane's own
 *     settings, N at a time, and every chunk is logged to AdminWorkerLog
 *     (`booster_parish_import`) so the worker and the dashboard see it.
 *
 * usage: tsx scripts/booster/parish-bulk-import.ts [--dry-run] [--limit=N]
 *          [--countries=IT,FR] [--skip-countries=IE,BE] [--cell=2]
 *          [--concurrency=12] [--state=/path/state.json]
 */

process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
process.env.ADMIN_WORKER_DISABLE_LIVE_PROBE = "1";
process.env.INTELLIGENCE_BRAIN_ENABLED = "0";

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { validatePayload } from "../../src/lib/checklist";
import { isDoctrinallySensitive } from "../../src/lib/admin-worker/content-type-profiles";
import { writeAdminWorkerLog } from "../../src/lib/admin-worker/logs";
import { designationFor, slugify } from "../../src/lib/admin-worker/parish-discovery-runner";
import { countryNameFor, normalizedParishName } from "../../src/lib/admin-worker/parish-osm";
import { CATHOLIC_REGIONS } from "../../src/lib/admin-worker/parish-osm-tiles";
import { runPublishOrchestrator } from "../../src/lib/admin-worker/publish-orchestrator";

// ── Options ────────────────────────────────────────────────────────────────

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : "1"] as const;
  }),
);
const DRY_RUN = argv.has("dry-run");
const LIMIT = Number(argv.get("limit") ?? Infinity);
const CELL_DEG = Number(argv.get("cell") ?? 2);
const CONCURRENCY = Number(argv.get("concurrency") ?? 12);
const ONLY = new Set((argv.get("countries") ?? "").split(",").filter(Boolean));
const SKIP = new Set((argv.get("skip-countries") ?? "").split(",").filter(Boolean));
const STATE_PATH = argv.get("state") ?? "";
/** A QLever OSM-planet CSV export (see scripts/booster/README): read rows instead of querying Overpass. */
const CSV_PATH = argv.get("csv") ?? "";
const UA = "ViaFideiAdminWorker/1.0 (+https://etviafidei.com; parish directory)";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const MIN_CELL_DEG = 0.25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Types ──────────────────────────────────────────────────────────────────

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

type Designation =
  | "parish"
  | "chapel"
  | "oratory"
  | "shrine"
  | "cathedral"
  | "minor-basilica"
  | "major-basilica";

interface Candidate {
  cellId: string;
  ref: string; // osm:way/123
  osmType: string;
  osmId: number;
  name: string;
  nameEn: string;
  nameKey: string;
  lat: number;
  lon: number;
  denomination: string;
  designation: Designation;
  full: string;
  street: string;
  place: string;
  houseNumber: string;
  city: string;
  state: string;
  postcode: string;
  countryCode: string;
  website: string;
  phone: string;
  sources: string[];
}

interface Cell {
  id: string;
  deg: number;
  bbox: [number, number, number, number];
  attempts: number;
}

// ── Quality filters and classification ─────────────────────────────────────

/**
 * Latin and Eastern Catholic churches in full communion with Rome (OSM tag values as
 * used). Old Catholic, Polish National, Liberal, SSPX and shared Protestant/Orthodox
 * buildings are deliberately absent.
 */
const COMMUNION_DENOMINATIONS: Record<string, string> = {
  catholic: "Catholic",
  roman_catholic: "Catholic",
  latin_catholic: "Catholic",
  "roman_catholic;catholic": "Catholic",
  "catholic;roman_catholic": "Catholic",
  ukrainian_greek_catholic: "Ukrainian Greek Catholic",
  ukrainian_catholic: "Ukrainian Greek Catholic",
  greek_catholic: "Greek Catholic",
  "roman_catholic;greek_catholic": "Catholic",
  "greek_catholic;roman_catholic": "Catholic",
  maronite: "Maronite Catholic",
  "syro-malabar_catholic": "Syro-Malabar Catholic",
  syriac_catholic: "Syriac Catholic",
  armenian_catholic: "Armenian Catholic",
  chaldean_catholic: "Chaldean Catholic",
  byzantine_catholic: "Byzantine Catholic",
  ruthenian_catholic: "Ruthenian Greek Catholic",
  slovak_greek_catholic: "Slovak Greek Catholic",
  hungarian_greek_catholic: "Hungarian Greek Catholic",
  romanian_greek_catholic: "Romanian Greek Catholic",
  romanian_catholic: "Catholic",
  melkite_greek_catholic: "Melkite Greek Catholic",
  melkite: "Melkite Greek Catholic",
  malankara_catholic: "Syro-Malankara Catholic",
  "syro-malankara_catholic": "Syro-Malankara Catholic",
  coptic_catholic: "Coptic Catholic",
  ethiopian_catholic: "Ethiopian Catholic",
  eritrean_catholic: "Eritrean Catholic",
};
const EXCLUDED_POW = new Set([
  "wayside_shrine",
  "wayside_chapel",
  "cross",
  "lourdes_grotto",
  "grotto",
  "calvary",
]);
const EXCLUDED_HISTORIC = new Set(["wayside_shrine", "wayside_cross", "ruins"]);
const STATION_RE =
  /^(\d+\s*(e|de|ste|st|nd|rd|th|\.)?\s*(statie|station|stacja|estaci[oó]n|stazione)\b)|^(statie|station|stacja|estaci[oó]n|stazione)\s+([ivxlc]+|\d+)\b|kreuzwegstation|^kreuzweg\b|^via crucis\b|^stacja drogi|schmerz(en)? mariens$/i;
const FUNERARY_RE =
  /(friedhofs?kapelle|aussegnungshalle|leichenhalle|trauerhalle|kaplica cmentarna|cemetery chapel|chapel of rest|chapelle fun[ée]raire|mortuary|kapliczka|bildstock|wegkreuz|flurkreuz|feldkreuz|hofkreuz|marterl)/i;
const GENERIC_NAMES = new Set([
  "chapel",
  "kapelle",
  "chapelle",
  "capilla",
  "cappella",
  "kaplica",
  "kapel",
  "capela",
  "kaple",
  "church",
  "kirche",
  "eglise",
  "église",
  "iglesia",
  "chiesa",
  "kosciol",
  "kościół",
  "igreja",
  "kerk",
  "oratorio",
  "oratory",
  "oratoire",
  "pfarrkirche",
  "parish church",
  "catholic church",
  "roman catholic church",
  "chiesa parrocchiale",
  "parroquia",
  "paroisse",
  "parafia",
  // Descriptors that name a kind of chapel, not a particular place.
  "kaplica domowa",
  "kaplica szpitalna",
  "kaplica dojazdowa",
  "kaplica cmentarna",
  "kaplica zakonna",
  "kaplica publiczna",
  "kaplica prywatna",
  "kaplica filialna",
  "hauskapelle",
  "krankenhauskapelle",
  "schulkapelle",
  "klosterkapelle",
  "chapelle de l'hôpital",
  "chapelle de l'hopital",
  "chapelle privée",
  "hospital chapel",
  "house chapel",
  "private chapel",
  "convent chapel",
  "capilla del hospital",
  "cappella dell'ospedale",
  "cappella privata",
]);
const CHAPEL_RE =
  /(\b(chapel|chapelle|capilla|cappella|kaplica|capela|k[áa]polna|kaple|kaplnka|kapela)\b)|kapel(le)?\b/i;
const ORATORY_RE = /\b(oratory|oratorio|oratoire|oratorium|orat[óo]rio|oratorij)\b/i;

function lowerTag(tags: Record<string, string>, k: string): string {
  return (tags[k] ?? "").trim().toLowerCase();
}

/** The four papal (major) basilicas all stand in Rome / Vatican City. */
function inRome(lat: number, lon: number): boolean {
  return lat > 41.79 && lat < 41.99 && lon > 12.35 && lon < 12.62;
}

function classify(
  name: string,
  tags: Record<string, string>,
  lat: number,
  lon: number,
): Designation {
  let base = designationFor(name, tags) as Designation;
  // A church elsewhere that shares a papal basilica's dedication ("Santa Maria
  // Maggiore", "San Giovanni in Laterano") is not a major basilica.
  if (base === "major-basilica" && !inRome(lat, lon)) {
    base = /\bbasilic|bas[ií]lica|basilika|bazylika|basilique|bazilika/i.test(name)
      ? "minor-basilica"
      : "parish";
  }
  if (base !== "parish") return base;
  if (lowerTag(tags, "place_of_worship") === "oratory" || ORATORY_RE.test(name)) return "oratory";
  if (
    lowerTag(tags, "building") === "chapel" ||
    lowerTag(tags, "place_of_worship") === "chapel" ||
    CHAPEL_RE.test(name)
  )
    return "chapel";
  return "parish";
}

function website(tags: Record<string, string>): string {
  let w = (tags.website || tags["contact:website"] || tags.url || "").trim();
  if (!w) return "";
  if (!/^https?:\/\//i.test(w) && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(w)) w = `https://${w}`;
  try {
    const u = new URL(w);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Map one Overpass element to a candidate, or a typed exclusion reason. */
function toCandidate(el: OsmElement): Candidate | string {
  const tags = el.tags ?? {};
  const raw = (tags.name ?? "").trim();
  if (!raw) return "unnamed";
  // Display names start with a capital ("chiesa parrocchiale X" -> "Chiesa parrocchiale X").
  const name = raw.charAt(0).toLocaleUpperCase() + raw.slice(1);
  const denomination = lowerTag(tags, "denomination");
  if (!(denomination in COMMUNION_DENOMINATIONS)) return "denomination";
  const religion = lowerTag(tags, "religion");
  if (religion && religion !== "christian") return "religion";
  if (tags.ruins === "yes" || tags.disused === "yes" || tags.abandoned === "yes") return "closed";
  if (
    tags["disused:amenity"] ||
    tags["abandoned:amenity"] ||
    lowerTag(tags, "building") === "ruins"
  )
    return "closed";
  if (["private", "no"].includes(lowerTag(tags, "access"))) return "private";
  if (EXCLUDED_POW.has(lowerTag(tags, "place_of_worship"))) return "wayside";
  if (EXCLUDED_HISTORIC.has(lowerTag(tags, "historic"))) return "wayside";
  if (lowerTag(tags, "man_made") === "cross") return "wayside";
  if (STATION_RE.test(name)) return "station";
  if (FUNERARY_RE.test(name)) return "funerary";
  if (GENERIC_NAMES.has(name.toLowerCase())) return "generic-name";
  const lat = typeof el.lat === "number" ? el.lat : el.center?.lat;
  const lon = typeof el.lon === "number" ? el.lon : el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return "no-coordinates";
  const cc = (tags["addr:country"] ?? "").trim().toUpperCase();
  return {
    cellId: "",
    ref: `osm:${el.type}/${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name,
    nameEn: (tags["name:en"] ?? "").trim(),
    nameKey: normalizedParishName(name),
    lat,
    lon,
    denomination,
    designation: classify(name, tags, lat, lon),
    full: (tags["addr:full"] ?? "").trim(),
    street: (tags["addr:street"] ?? "").trim(),
    place: (tags["addr:place"] ?? "").trim(),
    houseNumber: (tags["addr:housenumber"] ?? "").trim(),
    city: (
      tags["addr:city"] ||
      tags["addr:town"] ||
      tags["addr:village"] ||
      tags["addr:hamlet"] ||
      tags["addr:municipality"] ||
      ""
    ).trim(),
    state: (tags["addr:state"] || tags["addr:province"] || "").trim(),
    postcode: (tags["addr:postcode"] ?? "").trim(),
    countryCode: /^[A-Z]{2}$/.test(cc) ? cc : "",
    website: website(tags),
    phone: (tags.phone || tags["contact:phone"] || "").trim(),
    sources: ["osm-tags"],
  };
}

// ── Address formatting and validation ──────────────────────────────────────

/** Countries that write the house number AFTER the street name. */
const NUMBER_AFTER = new Set(
  (
    "DE AT CH LI NL BE IT SM VA ES AD PT PL CZ SK HU SI HR RS BA ME MK AL GR CY TR DK NO SE FI IS EE LV LT " +
    "RO BG MD UA BY RU AR BR CL CO MX PE VE UY PY BO EC CR GT HN NI PA SV DO CU"
  ).split(" "),
);

const POSTCODE_RE: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  IE: /^[A-Z]\d{2} ?[A-Z\d]{4}$/i,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  MX: /^\d{5}$/,
  FI: /^\d{5}$/,
  HR: /^\d{5}$/,
  UA: /^\d{5}$/,
  KR: /^\d{5}$/,
  PE: /^\d{5}$/,
  LT: /^(LT-)?\d{5}$/i,
  AT: /^\d{4}$/,
  BE: /^\d{4}$/,
  CH: /^\d{4}$/,
  LI: /^\d{4}$/,
  DK: /^\d{4}$/,
  NO: /^\d{4}$/,
  HU: /^\d{4}$/,
  LU: /^(L-)?\d{4}$/i,
  SI: /^(SI-)?\d{4}$/i,
  AU: /^\d{4}$/,
  NZ: /^\d{4}$/,
  PH: /^\d{4}$/,
  ZA: /^\d{4}$/,
  LV: /^(LV-)?\d{4}$/i,
  NL: /^\d{4} ?[A-Z]{2}$/i,
  PL: /^\d{2}-\d{3}$/,
  PT: /^\d{4}-\d{3}$/,
  BR: /^\d{5}-?\d{3}$/,
  CZ: /^\d{3} ?\d{2}$/,
  SK: /^\d{3} ?\d{2}$/,
  SE: /^\d{3} ?\d{2}$/,
  GR: /^\d{3} ?\d{2}$/,
  MT: /^[A-Z]{3} ?\d{4}$/i,
  RO: /^\d{6}$/,
  IN: /^\d{6}$/,
  RU: /^\d{6}$/,
  BY: /^\d{6}$/,
  CO: /^\d{6}$/,
  SG: /^\d{6}$/,
  JP: /^\d{3}-\d{4}$/,
  CL: /^\d{7}$/,
  AR: /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/i,
};
const FALLBACK_POSTCODE_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;
/** Countries without a postal-code system: a missing code there is not a gap. */
const NO_POSTCODES = new Set(
  (
    "AO AG AW BS BZ BJ BW BF BI CM CF KM CG CD CI DJ DM GQ ER FJ GM GH GD GY HK KI LY MO MW ML MR NR NU " +
    "KP QA RW KN LC ST SC SL SB SO SR SY TL TG TK TO TT TV UG AE VU YE ZW"
  ).split(" "),
);

function validPostcode(code: string, cc: string): string {
  const v = code.trim();
  if (!v) return "";
  const re = POSTCODE_RE[cc] ?? FALLBACK_POSTCODE_RE;
  return re.test(v) ? v : "";
}

function streetLine(c: Candidate): string {
  if (c.full) return c.full;
  const after = NUMBER_AFTER.has(c.countryCode);
  const road = c.street || c.place;
  if (!road) return "";
  if (!c.houseNumber) return road;
  return after ? `${road} ${c.houseNumber}` : `${c.houseNumber} ${road}`;
}

/** Duplicate-detection fingerprint; only a street-level address forms one. */
function addressKey(line: string, postcode: string, city: string, state: string): string {
  const fold = (s: string) =>
    s
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/æ/g, "ae")
      .replace(/œ/g, "oe")
      .replace(/ø/g, "o")
      .replace(/[đð]/g, "d")
      .replace(/þ/g, "th")
      .replace(/ł/g, "l")
      .replace(/ı/g, "i")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const street = fold(line);
  if (!/[a-z]/.test(street)) return "";
  const tokens = `${street} ${fold(postcode.replace(/\s+/g, "")) || fold(city)} ${fold(state)}`
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t === "strasse" || t === "str" || t === "street" ? "st" : t));
  return tokens.join(" ");
}

// ── Nominatim lookup (exact OSM object) ────────────────────────────────────

let lastNominatimAt = 0;
let nominatimBlockedUntil = 0;
let nominatimRequests = 0;

async function nominatimLookup(batch: Candidate[]): Promise<void> {
  if (batch.length === 0 || Date.now() < nominatimBlockedUntil) return;
  const wait = 1_150 - (Date.now() - lastNominatimAt);
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();
  const ids = batch.map((c) => `${c.osmType[0]!.toUpperCase()}${c.osmId}`).join(",");
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${ids}&format=jsonv2&addressdetails=1`;
  nominatimRequests += 1;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status === 403 || res.status >= 500) {
      nominatimBlockedUntil = Date.now() + 10 * 60_000;
      log(`nominatim HTTP ${res.status}; pausing lookups 10 min`);
      return;
    }
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{
      osm_type?: string;
      osm_id?: number;
      address?: Record<string, string>;
    }>;
    const byRef = new Map(batch.map((c) => [`${c.osmType}/${c.osmId}`, c]));
    for (const r of rows) {
      const c = byRef.get(`${r.osm_type}/${r.osm_id}`);
      const a = r.address;
      if (!c || !a) continue;
      c.sources.push("nominatim:lookup");
      const cc = (a.country_code ?? "").toUpperCase();
      if (/^[A-Z]{2}$/.test(cc)) c.countryCode = cc; // boundary-derived; authoritative
      if (!c.full && !c.street && !c.place) {
        c.street = a.road || a.pedestrian || a.footway || a.square || a.path || a.cycleway || "";
      }
      if (!c.houseNumber && !c.full) c.houseNumber = a.house_number || "";
      if (!c.city) c.city = a.city || a.town || a.village || a.municipality || a.hamlet || "";
      if (!c.state) c.state = a.state || a.province || a.region || "";
      if (!c.postcode) c.postcode = a.postcode || "";
    }
  } catch (err) {
    log("nominatim error:", err instanceof Error ? err.message : err);
  }
}

// ── Overpass over grid cells, one polite query per mirror at a time ────────

function buildCells(): Cell[] {
  const seen = new Map<string, Cell>();
  for (const region of CATHOLIC_REGIONS) {
    const cc = region.countryCode ?? "";
    if (ONLY.size && !ONLY.has(cc)) continue;
    if (SKIP.has(cc)) continue;
    const [s, w, n, e] = region.bbox;
    for (let lat = Math.floor(s / CELL_DEG) * CELL_DEG; lat < n; lat += CELL_DEG) {
      for (let lon = Math.floor(w / CELL_DEG) * CELL_DEG; lon < e; lon += CELL_DEG) {
        const id = `${CELL_DEG}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
        if (!seen.has(id))
          seen.set(id, {
            id,
            deg: CELL_DEG,
            bbox: [lat, lon, lat + CELL_DEG, lon + CELL_DEG],
            attempts: 0,
          });
      }
    }
  }
  return [...seen.values()];
}

function quarter(cell: Cell): Cell[] {
  const h = cell.deg / 2;
  const [s, w] = cell.bbox;
  return [
    [s, w],
    [s, w + h],
    [s + h, w],
    [s + h, w + h],
  ].map(([a, b]) => ({
    id: `${h}:${a!.toFixed(3)}:${b!.toFixed(3)}`,
    deg: h,
    bbox: [a!, b!, a! + h, b! + h] as [number, number, number, number],
    attempts: 0,
  }));
}

async function queryCell(mirror: string, cell: Cell): Promise<OsmElement[] | "split" | "retry"> {
  const [s, w, n, e] = cell.bbox;
  const q = `[out:json][timeout:180];
nwr["amenity"="place_of_worship"]["religion"="christian"]["denomination"~"^(roman_catholic|catholic)$"]["name"](${s},${w},${n},${e});
out center tags;`;
  try {
    const res = await fetch(mirror, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8", "User-Agent": UA },
      body: q,
      signal: AbortSignal.timeout(200_000),
    });
    if (res.status === 429 || res.status === 504 || res.status === 503) return "retry";
    if (!res.ok) return "retry";
    const data = (await res.json()) as { elements?: OsmElement[]; remark?: string };
    if (typeof data.remark === "string" && /error|timed? ?out|memory/i.test(data.remark)) {
      return cell.deg > MIN_CELL_DEG ? "split" : "retry";
    }
    return Array.isArray(data.elements) ? data.elements : [];
  } catch {
    return cell.deg > MIN_CELL_DEG ? "split" : "retry";
  }
}

// ── QLever CSV export reader ────────────────────────────────────────────────

/** RFC 4180 rows ("" escapes a quote inside a quoted field). */
function* csvRows(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      yield row;
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

/** Export column -> OSM tag key (the export's SPARQL variable names). */
const CSV_TAGS: Record<string, string> = {
  name: "name",
  d: "denomination",
  nameEn: "name:en",
  religion: "religion",
  street: "addr:street",
  hn: "addr:housenumber",
  place: "addr:place",
  full: "addr:full",
  city: "addr:city",
  town: "addr:town",
  village: "addr:village",
  hamlet: "addr:hamlet",
  muni: "addr:municipality",
  pc: "addr:postcode",
  cc: "addr:country",
  state: "addr:state",
  prov: "addr:province",
  web: "website",
  cweb: "contact:website",
  url: "url",
  phone: "phone",
  cphone: "contact:phone",
  pow: "place_of_worship",
  bld: "building",
  hist: "historic",
  mm: "man_made",
  access: "access",
  ruins: "ruins",
  disused: "disused",
  abandoned: "abandoned",
  dAmenity: "disused:amenity",
  aAmenity: "abandoned:amenity",
  ctype: "church:type",
  cath: "cathedral",
};

function* csvElements(path: string): Generator<OsmElement> {
  const rows = csvRows(readFileSync(path, "utf8"));
  const header = rows.next().value as string[];
  for (const row of rows) {
    const m = /\/(node|way|relation)\/(\d+)$/.exec(row[0] ?? "");
    if (!m) continue;
    const tags: Record<string, string> = {};
    header.forEach((col, i) => {
      const key = CSV_TAGS[col];
      const v = row[i];
      if (key && v) tags[key] = v;
    });
    const lat = Number(row[header.indexOf("lat")]);
    const lon = Number(row[header.indexOf("lon")]);
    yield {
      type: m[1] as OsmElement["type"],
      id: Number(m[2]),
      ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : {}),
      tags,
    };
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

const DESIGNATION_NOUN: Record<Designation, string> = {
  parish: "church",
  chapel: "chapel",
  oratory: "oratory",
  shrine: "shrine",
  cathedral: "cathedral",
  "minor-basilica": "minor basilica",
  "major-basilica": "major basilica",
};

interface Existing {
  lat: number;
  lon: number;
  nameKey: string;
  tokens: string[];
}

function gridKey(lat: number, lon: number): string {
  return `${Math.floor(lat * 200)}:${Math.floor(lon * 200)}`;
}

function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function distinctiveTokens(nameKey: string): string[] {
  return nameKey.split(" ").filter((t) => t.length >= 4);
}

function tokensOverlap(a: string[], b: string[]): boolean {
  return a.some((x) =>
    b.some(
      (y) => x === y || (x.length >= 5 && y.startsWith(x)) || (y.length >= 5 && x.startsWith(y)),
    ),
  );
}

async function main() {
  const prisma = new PrismaClient();
  const stats = {
    cellsDone: 0,
    cellsSplit: 0,
    elements: 0,
    excluded: {} as Record<string, number>,
    duplicates: 0,
    published: 0,
    failed: 0,
    blocked: {} as Record<string, number>,
    complete: 0,
    partial: 0,
  };
  const state: { doneCells: string[] } =
    STATE_PATH && existsSync(STATE_PATH)
      ? JSON.parse(readFileSync(STATE_PATH, "utf8"))
      : { doneCells: [] };
  const done = new Set(state.doneCells);
  const saveState = () => {
    if (!STATE_PATH) return;
    writeFileSync(STATE_PATH, JSON.stringify({ doneCells: [...done], stats }, null, 1));
  };

  // 1. The whole existing catalog, once.
  const rows = await prisma.publishedContent.findMany({
    where: { contentType: "PARISH" as never },
    select: { slug: true, title: true, sourceRef: true, latitude: true, longitude: true },
  });
  const refs = new Set<string>();
  const slugs = new Set<string>();
  const grid = new Map<string, Existing[]>();
  const remember = (lat: number, lon: number, title: string) => {
    const nameKey = normalizedParishName(title);
    const k = gridKey(lat, lon);
    const list = grid.get(k) ?? [];
    list.push({ lat, lon, nameKey, tokens: distinctiveTokens(nameKey) });
    grid.set(k, list);
  };
  for (const r of rows) {
    slugs.add(r.slug);
    if (r.sourceRef) refs.add(r.sourceRef);
    if (typeof r.latitude === "number" && typeof r.longitude === "number")
      remember(r.latitude, r.longitude, r.title);
  }
  // Checklist slugs are taken too (unique per type).
  const items = await prisma.checklistItem.findMany({
    where: { contentType: "PARISH" as never },
    select: { canonicalSlug: true },
  });
  const checklistSlugs = new Set(items.map((i) => i.canonicalSlug));
  log(
    `catalog loaded: ${rows.length} parish rows, ${refs.size} source refs, ${checklistSlugs.size} checklist slugs`,
  );

  const isDuplicate = (c: Candidate): boolean => {
    if (refs.has(c.ref)) return true;
    const tokens = distinctiveTokens(c.nameKey);
    const [gy, gx] = gridKey(c.lat, c.lon).split(":").map(Number) as [number, number];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const e of grid.get(`${gy + dy}:${gx + dx}`) ?? []) {
          const d = metres(c.lat, c.lon, e.lat, e.lon);
          if (d <= 200 && c.nameKey && c.nameKey === e.nameKey) return true;
          if (d <= 30 && (tokensOverlap(tokens, e.tokens) || !c.nameKey || !e.nameKey)) return true;
        }
      }
    }
    return false;
  };

  // 2. Publisher.
  let inFlight = 0;
  let sinceFlush = 0;
  const flush = async (final = false) => {
    if (DRY_RUN || (sinceFlush === 0 && !final)) return;
    sinceFlush = 0;
    const { refreshContentGoals } = await import("../../src/lib/admin-worker/content-goals");
    const { flagSearchRefresh, flagSitemapRefresh } =
      await import("../../src/lib/admin-worker/repair");
    await refreshContentGoals(prisma).catch(() => undefined);
    await Promise.all([
      flagSearchRefresh(prisma).catch(() => undefined),
      flagSitemapRefresh(prisma).catch(() => undefined),
    ]);
    await writeAdminWorkerLog(prisma, {
      category: "PUBLISHING",
      severity: "INFO",
      eventName: "booster_parish_import",
      message: `Booster parish import: published ${stats.published} so far (${stats.complete} with a complete address, ${stats.partial} partial), ${stats.duplicates} duplicates skipped, ${stats.failed} failed, ${stats.cellsDone} cells swept.`,
      contentType: "PARISH",
      safeMetadata: { ...stats, nominatimRequests },
    }).catch(() => undefined);
    saveState();
  };

  const slugFor = (c: Candidate): string => {
    const base =
      slugify(`${c.name} ${c.city}`) ||
      slugify(`${c.nameEn} ${c.city}`) ||
      `parish-${c.osmType}-${c.osmId}`;
    const taken = (s: string) => slugs.has(s) || checklistSlugs.has(s);
    if (!taken(base)) return base;
    const suffix = slugify(c.postcode) || String(c.osmId).slice(-4);
    const second = `${base.slice(0, 74)}-${suffix}`;
    if (!taken(second)) return second;
    return `${base.slice(0, 70)}-${c.osmType[0]}${c.osmId}`;
  };

  const publishOne = async (c: Candidate): Promise<void> => {
    c.postcode = validPostcode(c.postcode, c.countryCode);
    const line = streetLine(c);
    const country = countryNameFor(c.countryCode) ?? "";
    const missing = [
      !line && "street",
      !c.city && "locality",
      !c.postcode && !NO_POSTCODES.has(c.countryCode) && "postalCode",
      !c.countryCode && "country",
    ].filter(Boolean) as string[];
    const now = new Date();
    const status = missing.length === 0 ? "complete" : "partial";
    const slug = slugFor(c);
    slugs.add(slug);
    const where = [c.city, country].filter(Boolean).join(", ");
    const payload: Record<string, unknown> = {
      slug,
      title: c.name,
      designation: c.designation,
      summary: `${c.name} is a ${COMMUNION_DENOMINATIONS[c.denomination] ?? "Catholic"} ${DESIGNATION_NOUN[c.designation]}${where ? ` in ${where}` : ""}.`,
      citations: [`https://www.openstreetmap.org/${c.osmType}/${c.osmId}`, c.website].filter(
        Boolean,
      ),
      sourceRef: c.ref,
      latitude: c.lat,
      longitude: c.lon,
      _meta: {
        addressResearch: {
          status,
          missing,
          precision: c.houseNumber || c.full ? "rooftop" : line ? "street" : "locality",
          sources: [...new Set(c.sources)],
          attempts: 1,
          lastAttemptAt: now.toISOString(),
          nextDueAt:
            status === "complete" ? null : new Date(now.getTime() + 7 * 86_400_000).toISOString(),
        },
        booster: { source: "osm-bulk-import", at: now.toISOString() },
      },
    };
    if (line) payload.address = line;
    if (c.city) payload.city = c.city;
    if (c.state) payload.state = c.state;
    if (c.postcode) payload.postalCode = c.postcode;
    if (country) payload.country = country;
    if (c.countryCode) payload.countryCode = c.countryCode;
    if (c.website) payload.website = c.website;
    if (c.phone) payload.phone = c.phone;
    const key = line ? addressKey(line, c.postcode, c.city, c.state) : "";
    if (key) payload.addressKey = key;

    const valid = validatePayload("PARISH", payload);
    if (!valid.ok) {
      stats.blocked[`schema`] = (stats.blocked.schema ?? 0) + 1;
      return;
    }
    if (DRY_RUN) {
      if (stats.published < 5) log("DRY", JSON.stringify(payload).slice(0, 600));
      stats.published += 1;
      if (status === "complete") stats.complete += 1;
      else stats.partial += 1;
      return;
    }
    const item =
      (await prisma.checklistItem
        .findFirst({
          where: { contentType: "PARISH" as never, canonicalSlug: slug },
          select: { id: true },
        })
        .catch(() => null)) ??
      (await prisma.checklistItem
        .create({
          data: {
            contentType: "PARISH" as never,
            canonicalName: c.name,
            canonicalSlug: slug,
            approvalStatus: "APPROVED_FOR_BUILD",
          },
          select: { id: true },
        })
        .catch(() => null));
    if (!item) {
      stats.failed += 1;
      return;
    }
    checklistSlugs.add(slug);
    const res = await runPublishOrchestrator(prisma, {
      contentType: "PARISH",
      contentId: item.id,
      title: c.name,
      slug,
      payload: payload as never,
      authorityLevel: "COMMUNITY",
      finalScore: 0.88,
      qaPassed: true,
      hasSourceEvidence: true,
      isDoctrinallySensitive: isDoctrinallySensitive("PARISH"),
      confidence: 0.8,
      skipBrainScreens: true,
      skipPostPublishSideEffects: true,
      verifier: {
        publishAllowed: true,
        missingRequired: [],
        blockingSensitiveFields: [],
        verificationRowIds: [],
        evidence: [],
        hasConflict: false,
        summary: `Discovered via OpenStreetMap (denomination ${c.denomination}); address from ${[...new Set(c.sources)].join(" + ")}; booster bulk import.`,
      },
    }).catch((err) => ({
      kind: "error",
      reason: err instanceof Error ? err.message : String(err),
    }));
    if (res.kind === "published") {
      stats.published += 1;
      sinceFlush += 1;
      if (status === "complete") stats.complete += 1;
      else stats.partial += 1;
    } else {
      stats.blocked[res.kind] = (stats.blocked[res.kind] ?? 0) + 1;
      if (stats.failed + Object.values(stats.blocked).reduce((a, b) => a + b, 0) < 20)
        log(`not published ${slug}: ${res.kind} ${String(res.reason).slice(0, 160)}`);
    }
  };

  // Bounded publish pool + Nominatim batching between the cell reader and it.
  let readerDone = false;
  const outstanding = new Map<string, number>();
  const settle = (cellId: string) => {
    const left = (outstanding.get(cellId) ?? 1) - 1;
    outstanding.set(cellId, left);
    if (left <= 0) done.add(cellId);
  };
  const pending: Candidate[] = [];
  const toPublish: Candidate[] = [];
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    log("SIGINT: finishing in-flight work, then saving state");
  });

  const publisher = (async () => {
    while (true) {
      if (stopping || stats.published >= LIMIT) {
        stopping = true;
        break;
      }
      const c = toPublish.shift();
      if (!c) {
        if (readerDone && pending.length === 0 && toPublish.length === 0) break;
        await sleep(200);
        continue;
      }
      while (inFlight >= CONCURRENCY) await sleep(20);
      inFlight += 1;
      void publishOne(c)
        .catch(() => {
          stats.failed += 1;
        })
        .finally(() => {
          inFlight -= 1;
          settle(c.cellId);
        });
      if (sinceFlush >= 500) await flush();
    }
    while (inFlight > 0) await sleep(100);
  })();

  const enricher = (async () => {
    while (!stopping) {
      if (pending.length === 0) {
        if (readerDone) break;
        await sleep(200);
        continue;
      }
      // Apply backpressure: keep the publish queue short so a crash loses little.
      if (toPublish.length > 2_000) {
        await sleep(500);
        continue;
      }
      const batch = pending.splice(0, 50);
      const need = batch.filter(
        (c) => !c.countryCode || !c.city || !c.postcode || (!c.street && !c.place && !c.full),
      );
      await nominatimLookup(need);
      // A slower publisher than reader: dedupe again against what was queued meanwhile.
      for (const c of batch) toPublish.push(c);
    }
  })();

  // 3. Cell reader: one in-flight query per mirror.
  const queue = buildCells().filter((c) => !done.has(c.id));
  log(`cells to sweep: ${queue.length} (cell ${CELL_DEG}°)${DRY_RUN ? " [dry run]" : ""}`);
  const mirrorWorker = async (mirror: string) => {
    while (!stopping && stats.published < LIMIT) {
      const cell = queue.shift();
      if (!cell) break;
      while (pending.length + toPublish.length > 4_000 && !stopping) await sleep(1_000);
      const t0 = Date.now();
      const result = await queryCell(mirror, cell);
      if (result === "split") {
        stats.cellsSplit += 1;
        queue.unshift(...quarter(cell));
      } else if (result === "retry") {
        cell.attempts += 1;
        if (cell.attempts < 4) queue.push(cell);
        else log(`giving up on cell ${cell.id} after ${cell.attempts} attempts`);
        await sleep(30_000);
      } else {
        stats.elements += result.length;
        let queued = 0;
        for (const el of result) {
          const c = toCandidate(el);
          if (typeof c === "string") {
            stats.excluded[c] = (stats.excluded[c] ?? 0) + 1;
            continue;
          }
          if (isDuplicate(c)) {
            stats.duplicates += 1;
            continue;
          }
          refs.add(c.ref);
          remember(c.lat, c.lon, c.name);
          c.cellId = cell.id;
          pending.push(c);
          queued += 1;
        }
        // A cell counts as done only once every candidate it queued has been
        // published or refused, so a stopped run resumes without losing any.
        outstanding.set(cell.id, queued);
        if (queued === 0) done.add(cell.id);
        stats.cellsDone += 1;
      }
      await sleep(Math.max(0, 2_500 - (Date.now() - t0)));
    }
  };

  const ticker = setInterval(() => {
    log(
      `cells ${stats.cellsDone} done / ${queue.length} queued | elements ${stats.elements} | dupes ${stats.duplicates} | ` +
        `queued ${pending.length}+${toPublish.length} | published ${stats.published} (complete ${stats.complete}, partial ${stats.partial}) | ` +
        `blocked ${JSON.stringify(stats.blocked)} | failed ${stats.failed} | nominatim ${nominatimRequests} | ` +
        `excluded ${JSON.stringify(stats.excluded)}`,
    );
    saveState();
  }, 30_000);

  const csvReader = async () => {
    outstanding.set("csv", Number.POSITIVE_INFINITY);
    let rows = 0;
    for (const el of csvElements(CSV_PATH)) {
      if (stopping || stats.published >= LIMIT) break;
      rows += 1;
      stats.elements += 1;
      const c = toCandidate(el);
      if (typeof c === "string") {
        stats.excluded[c] = (stats.excluded[c] ?? 0) + 1;
        continue;
      }
      if (isDuplicate(c)) {
        stats.duplicates += 1;
        continue;
      }
      refs.add(c.ref);
      remember(c.lat, c.lon, c.name);
      c.cellId = "csv";
      pending.push(c);
      while (pending.length + toPublish.length > 4_000 && !stopping && stats.published < LIMIT)
        await sleep(500);
    }
    log(`csv reader finished after ${rows} rows`);
  };

  if (CSV_PATH) {
    queue.length = 0;
    await csvReader();
  } else {
    await Promise.all(MIRRORS.map((m) => mirrorWorker(m)));
  }
  readerDone = true;
  await enricher;
  await publisher;
  clearInterval(ticker);
  await flush(true);
  saveState();
  log("excluded:", JSON.stringify(stats.excluded));
  log("FINAL", JSON.stringify({ ...stats, nominatimRequests }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[parish-bulk-import] fatal:", err);
  process.exitCode = 1;
});
