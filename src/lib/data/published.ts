/**
 * Public-facing data access — reads from the PublishedContent table
 * written by the checklist-first worker.
 *
 * Every public page on the site goes through these helpers; there is no
 * other path from the database to the public site.
 */

import type { Metadata } from "next";
import type { ChecklistContentType } from "@prisma/client";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { compareSaintsChronologically } from "@/lib/content-shared/saints";
import { categorizePrayer, prayerCategoryLabel } from "@/lib/content-shared/prayer-categories";
import { publicRouteFor } from "@/lib/admin-worker/public-routes";
import { MEMO_TTL, memo } from "@/lib/cache/memo";

export interface PublishedItem {
  id: string;
  checklistItemId: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  /** One-line descriptive subtitle (stored, or generated as a fallback). */
  subtitle: string;
  payload: Record<string, unknown>;
  authorityLevel: string;
  version: number;
  publishedAt: Date | null;
}

function deserialize(
  row: Awaited<ReturnType<typeof prisma.publishedContent.findFirst>>,
): PublishedItem | null {
  if (!row) return null;
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    checklistItemId: row.checklistItemId,
    contentType: row.contentType,
    slug: row.slug,
    title: row.title,
    subtitle:
      (row as { subtitle?: string | null }).subtitle ??
      generateContentSubtitle({
        contentType: row.contentType,
        contentSubtype: (payload.contentSubtype as string | null) ?? null,
        title: row.title,
        fields: payload,
      }),
    payload,
    authorityLevel: row.authorityLevel,
    version: row.version,
    publishedAt: row.publishedAt,
  };
}

/**
 * Every published row of a content type, payloads included.
 *
 * Correct but unbounded, so it belongs only to the small types (the seven
 * sacraments, the rites, the doctors). Anything that grows — saints, parishes,
 * prayers — must use `listPublishedPage` instead: this one materialises the
 * whole type and its JSON on every request. It is deliberately NOT capped,
 * because silently truncating a listing would hide published content; the
 * callers move to the paged helper instead.
 */
export async function listPublished(contentType: ChecklistContentType): Promise<PublishedItem[]> {
  const rows = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true },
    orderBy: { title: "asc" },
  });
  return rows.map((row) => deserialize(row)!).filter(Boolean);
}

export async function getPublishedBySlug(
  contentType: ChecklistContentType,
  slug: string,
): Promise<PublishedItem | null> {
  const row = await prisma.publishedContent.findFirst({
    where: { contentType, slug, isPublished: true },
  });
  return deserialize(row);
}

/**
 * Resolve a published item by slug across several candidate content types, in
 * order — used by the routes that serve more than one type from one path
 * (Our Lady = Marian title or apparition; Liturgy & History = liturgical entry
 * or church document). Returns the first match, or null.
 */
export async function getAnyPublishedBySlug(
  slug: string,
  contentTypes: ChecklistContentType[],
): Promise<PublishedItem | null> {
  for (const contentType of contentTypes) {
    const item = await getPublishedBySlug(contentType, slug);
    if (item) return item;
  }
  return null;
}

/** Short, human label per content type for the share-card "VIA FIDEI · …" line. */
const CONTENT_TYPE_LABEL: Record<ChecklistContentType, string> = {
  PRAYER: "Prayer",
  SAINT: "Saint",
  APPARITION: "Apparition",
  MARIAN_TITLE: "Our Lady",
  POPE: "Pope",
  DOCTOR: "Doctor of the Church",
  PARISH: "Parish",
  DEVOTION: "Devotion",
  NOVENA: "Novena",
  GUIDE: "Guide",
  SACRAMENT: "Sacrament",
  LITURGICAL: "Liturgy",
  CHURCH_DOCUMENT: "Church Document",
  RITE: "Rite",
  SPIRITUAL_PRACTICE: "Spiritual Life",
};

/**
 * Human label for a content type — the one place raw enum values ("MARIAN_TITLE",
 * "CHURCH_DOCUMENT") are turned into words. Search results, share cards and
 * detail-page eyebrows all read from here so they can never print the enum.
 * `subtype` refines the label where the type alone is not the whole story
 * (a PRAYER whose prayerType is "litany" is a Litany).
 */
export function contentTypeLabel(
  contentType: ChecklistContentType,
  subtype?: string | null,
): string {
  if (contentType === "PRAYER" && subtype === "litany") return "Litany";
  return CONTENT_TYPE_LABEL[contentType] ?? "Via Fidei";
}

/** The label shown on the share image — litanies (PRAYER + prayerType "litany") read "Litany". */
function shareTypeLabel(item: PublishedItem): string {
  return contentTypeLabel(
    item.contentType,
    typeof item.payload.prayerType === "string" ? item.payload.prayerType : null,
  );
}

/**
 * The branded share-image URL for a content card: the Via Fidei crucifix mark
 * with the item's own title rendered in it (see `app/api/og`). Relative so Next
 * resolves it against `metadataBase` (the canonical domain) in the meta tag.
 */
export function shareImageUrl(title: string, typeLabel: string): string {
  const q = new URLSearchParams({ title, type: typeLabel });
  return `/api/og?${q.toString()}`;
}

/**
 * Build per-page share/SEO metadata for a published content card, so that a
 * shared link unfurls with the card's own title and summary, a branded share
 * image (the crucifix mark with the item's title in it), and the site favicon /
 * Open Graph defaults inherited from the root layout — rather than the generic
 * site title and the browser's default page icon. Returns empty metadata for a
 * missing item, letting the page fall through to notFound().
 */
export function buildPublishedMetadata(item: PublishedItem | null): Metadata {
  if (!item) return {};
  const rawSummary =
    typeof item.payload.summary === "string" && item.payload.summary.trim()
      ? item.payload.summary.trim()
      : item.subtitle || item.title;
  const description = rawSummary.length > 200 ? `${rawSummary.slice(0, 197)}…` : rawSummary;
  const image = shareImageUrl(item.title, shareTypeLabel(item));
  return {
    title: item.title,
    description,
    openGraph: {
      title: `${item.title} · Via Fidei`,
      description,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: item.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${item.title} · Via Fidei`,
      description,
      images: [image],
    },
  };
}

export async function listAllPublishedSlugs(contentType: ChecklistContentType): Promise<string[]> {
  const rows = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

export async function countPublished(): Promise<Record<ChecklistContentType, number>> {
  const rows = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: true,
  });
  const out: Partial<Record<ChecklistContentType, number>> = {};
  for (const row of rows) {
    out[row.contentType] = row._count;
  }
  return out as Record<ChecklistContentType, number>;
}

/** Content type → the header search-suggestion group it appears under. */
const CONTENT_TYPE_TO_SUGGEST_GROUP: Record<ChecklistContentType, string> = {
  PRAYER: "prayers",
  SAINT: "saints",
  APPARITION: "apparitions",
  MARIAN_TITLE: "apparitions",
  POPE: "popes",
  DOCTOR: "doctors",
  PARISH: "parishes",
  DEVOTION: "devotions",
  NOVENA: "novenas",
  GUIDE: "guides",
  SACRAMENT: "sacraments",
  LITURGICAL: "liturgy",
  CHURCH_DOCUMENT: "documents",
  RITE: "rites",
  SPIRITUAL_PRACTICE: "spiritualLife",
};

export interface SearchSuggestion {
  group: string;
  id: string;
  slug: string;
  label: string;
  /** Second line for the dropdown ("Bishop, Doctor of the Church"). */
  subtitle: string;
  /** Human content-type label for the row. */
  typeLabel: string;
  /** Canonical public path, so the dropdown does not rebuild routes itself. */
  href: string;
}

/* -------------------------------------------------------------------------
 * Paged, projected reads
 *
 * `listPublished` loads an entire content type with full JSON payloads. That
 * is fine for the small types (seven sacraments, sixteen rites) and ruinous
 * for the large ones: /saints, /parishes and the homepage each pulled every
 * row of their type on every request, deserialised it, then showed thirty.
 * The helpers below page and project in SQL instead, using the indexed
 * columns migration 0054 derives from the payload.
 * ---------------------------------------------------------------------- */

/** Projection returned by the list pages — never the payload. */
export interface PublishedListItem {
  id: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  subtitle: string;
  /** Indexed classification used by the filter chips (saintType, kind, …). */
  subtype: string | null;
  /** Canonical public path for this row (`/saints/agnes-of-rome`). */
  href: string;
}

export interface PublishedPage<T> {
  items: T[];
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * How a list page is ordered:
 *   - `title`         alphabetical (the historical default)
 *   - `chronological` earliest first via the indexed `sortYear` column
 *   - `feast`         calendar order via the indexed feast columns
 */
export type PublishedOrder = "title" | "chronological" | "feast";

export const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function clampPage(page: number | undefined): number {
  const n = Math.trunc(Number(page ?? 1));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function clampPageSize(size: number | undefined): number {
  const n = Math.trunc(Number(size ?? DEFAULT_PAGE_SIZE));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

/**
 * Subtitle for a projected row. Every row written since migration 0047 stores
 * one; the generator is kept as a fallback for older rows, driven by the
 * indexed `subtype` column rather than by loading the payload.
 */
function projectedSubtitle(row: {
  contentType: ChecklistContentType;
  title: string;
  subtitle: string | null;
  subtype: string | null;
}): string {
  if (row.subtitle && row.subtitle.trim()) return row.subtitle.trim();
  return generateContentSubtitle({
    contentType: row.contentType,
    contentSubtype: row.subtype,
    title: row.title,
    fields: {},
  });
}

const LIST_SELECT = {
  id: true,
  contentType: true,
  slug: true,
  title: true,
  subtitle: true,
  subtype: true,
} as const;

function toListItem(row: {
  id: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  subtype: string | null;
}): PublishedListItem {
  return {
    id: row.id,
    contentType: row.contentType,
    slug: row.slug,
    title: row.title,
    subtitle: projectedSubtitle(row),
    subtype: row.subtype,
    href: publicRouteFor(row.contentType, row.slug).slugPath,
  };
}

function orderByFor(order: PublishedOrder): Prisma.PublishedContentOrderByWithRelationInput[] {
  switch (order) {
    case "chronological":
      // Undated rows sort last rather than first — Postgres orders NULLs last
      // for ASC by default, but we say so explicitly so the plan is stable.
      return [{ sortYear: { sort: "asc", nulls: "last" } }, { title: "asc" }];
    case "feast":
      return [
        { feastMonth: { sort: "asc", nulls: "last" } },
        { feastDayOfMonth: { sort: "asc", nulls: "last" } },
        { title: "asc" },
      ];
    default:
      return [{ title: "asc" }];
  }
}

/**
 * One page of a content type, projected and ordered in SQL.
 *
 * `subtype` accepts one value or several (the filter chips map to more than
 * one stored value for some types). Passing `null`/undefined means "no filter".
 * The count is a separate indexed COUNT so the caller can render real,
 * crawlable page links instead of paginating in the browser.
 */
export async function listPublishedPage(
  contentType: ChecklistContentType,
  opts: {
    page?: number;
    pageSize?: number;
    subtype?: string | ReadonlyArray<string> | null;
    order?: PublishedOrder;
  } = {},
): Promise<PublishedPage<PublishedListItem>> {
  const page = clampPage(opts.page);
  const pageSize = clampPageSize(opts.pageSize);
  const order = opts.order ?? "title";
  const subtypes =
    opts.subtype == null ? null : Array.isArray(opts.subtype) ? [...opts.subtype] : [opts.subtype];

  const where: Prisma.PublishedContentWhereInput = {
    contentType,
    isPublished: true,
    ...(subtypes && subtypes.length > 0 ? { subtype: { in: subtypes as string[] } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.publishedContent.count({ where }),
    prisma.publishedContent.findMany({
      where,
      select: LIST_SELECT,
      orderBy: orderByFor(order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { items: rows.map(toListItem), total, page, pageSize, pageCount };
}

/**
 * How many published rows carry each `subtype`, for filter-chip presence.
 * Previously every page asked "does any row match this chip?" by scanning the
 * whole type in JS. Memoised for a minute: chips do not need to be live.
 */
export async function countPublishedBySubtype(
  contentType: ChecklistContentType,
): Promise<Record<string, number>> {
  return memo(`subtype-counts:${contentType}`, MEMO_TTL.list, async () => {
    const rows = await prisma.publishedContent.groupBy({
      by: ["subtype"],
      where: { contentType, isPublished: true },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const row of rows) {
      if (row.subtype) out[row.subtype] = row._count._all;
    }
    return out;
  });
}

/**
 * Saints whose feast falls on `month`/`day`, via the indexed feast columns —
 * the homepage's "today" block used to scan every saint and parse every
 * payload for this. Returns the full items (a feast day has tens of saints,
 * not thousands) ordered the way the site orders saints.
 *
 * Fail-open: if the indexed lookup finds nothing we retry once against the
 * legacy `payload.feastDay` string, so a row published before migration 0054
 * (or one whose columns were never backfilled) still shows up on its feast.
 */
export async function listSaintsForFeast(month: number, day: number): Promise<PublishedItem[]> {
  if (!Number.isInteger(month) || month < 1 || month > 12) return [];
  if (!Number.isInteger(day) || day < 1 || day > 31) return [];
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return memo(`saints-feast:${mmdd}`, MEMO_TTL.daily, async () => {
    let rows = await prisma.publishedContent.findMany({
      where: { contentType: "SAINT", isPublished: true, feastMonth: month, feastDayOfMonth: day },
    });
    if (rows.length === 0) {
      rows = await prisma.publishedContent.findMany({
        where: {
          contentType: "SAINT",
          isPublished: true,
          payload: { path: ["feastDay"], equals: mmdd },
        },
      });
    }
    return rows
      .map((row) => deserialize(row)!)
      .filter(Boolean)
      .sort(compareSaintsChronologically);
  });
}

/* -------------------------------------------------------------------------
 * Parishes
 *
 * The parish directory is the one content type whose goal (200,000 rows)
 * makes "load them all and filter in the browser" impossible. Both helpers
 * below project in SQL and never return more than one screen of rows.
 * ---------------------------------------------------------------------- */

export interface ParishListItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** Stored classification: parish, shrine, cathedral, basilica … */
  designation: string;
  /** "123 Main St, Austin, TX" — whatever parts the record has. */
  location: string;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  href: string;
  /** Only set by `listParishesNear`. */
  distanceMiles?: number;
}

type ParishRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  subtype: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  distance_miles?: number | null;
};

function toParishItem(row: ParishRow): ParishListItem {
  const designation = row.subtype ?? "parish";
  const location = [row.address, row.city, row.state]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(", ");
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: projectedSubtitle({
      contentType: "PARISH",
      title: row.title,
      subtitle: row.subtitle,
      subtype: row.subtype,
    }),
    designation,
    location,
    city: row.city,
    state: row.state,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    href: publicRouteFor("PARISH", row.slug).slugPath,
    ...(row.distance_miles == null ? {} : { distanceMiles: Number(row.distance_miles) }),
  };
}

/** The projected columns every parish list query returns. */
const PARISH_COLUMNS = Prisma.sql`
  "id", "slug", "title", "subtitle", "subtype", "latitude", "longitude",
  payload->>'address' AS "address",
  payload->>'city'    AS "city",
  payload->>'state'   AS "state",
  payload->>'country' AS "country"
`;

/**
 * One page of the parish directory, filtered by classification and/or a title
 * search. Thirty rows by default: the page used to receive the entire table as
 * client props, which at the directory's target size is tens of megabytes per
 * visitor.
 */
export async function listParishPage(
  opts: {
    page?: number;
    pageSize?: number;
    q?: string | null;
    /** Classification filter — one designation or several. */
    class?: string | ReadonlyArray<string> | null;
  } = {},
): Promise<PublishedPage<ParishListItem>> {
  const page = clampPage(opts.page);
  const pageSize = clampPageSize(opts.pageSize);
  const q = (opts.q ?? "").trim();
  const classes =
    opts.class == null ? [] : Array.isArray(opts.class) ? [...opts.class] : [String(opts.class)];

  const filters: Prisma.Sql[] = [
    Prisma.sql`"contentType" = 'PARISH'::"ChecklistContentType"`,
    Prisma.sql`"isPublished"`,
  ];
  if (classes.length > 0) filters.push(Prisma.sql`"subtype" = ANY(${classes})`);
  // ILIKE '%q%' is index-assisted whenever the pg_trgm title index exists
  // (migration 0055) and a bounded sequential scan otherwise.
  if (q) filters.push(Prisma.sql`"title" ILIKE ${`%${q}%`}`);
  const where = Prisma.join(filters, " AND ");

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`SELECT count(*)::bigint AS total FROM "PublishedContent" WHERE ${where}`,
    ),
    prisma.$queryRaw<ParishRow[]>(
      Prisma.sql`SELECT ${PARISH_COLUMNS} FROM "PublishedContent" WHERE ${where}
                 ORDER BY "title" ASC
                 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map(toParishItem),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Miles per degree of latitude — used to size the bounding-box prefilter. */
const MILES_PER_DEGREE_LAT = 69.0;
/** Mean Earth radius in miles, for the haversine ordering. */
const EARTH_RADIUS_MILES = 3958.7613;

/**
 * The parishes nearest a point, ordered by great-circle distance.
 *
 * The bounding box comes first so the indexed (latitude, longitude) columns do
 * the elimination; haversine then orders only what survives. Without the box
 * this would compute a trigonometric distance for every parish on earth on
 * every "use my location" tap.
 */
export async function listParishesNear(opts: {
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  take?: number;
}): Promise<ParishListItem[]> {
  const { latitude, longitude } = opts;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return [];
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return [];
  const radiusMiles = Math.min(Math.max(Number(opts.radiusMiles ?? 50) || 50, 1), 500);
  const take = Math.min(Math.max(Math.trunc(Number(opts.take ?? 50)) || 50, 1), 50);

  const dLat = radiusMiles / MILES_PER_DEGREE_LAT;
  // Longitude degrees shrink toward the poles; the cosine is floored so the box
  // stays finite at high latitude rather than dividing by ~0.
  const cos = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
  const dLng = radiusMiles / (MILES_PER_DEGREE_LAT * cos);

  const filters: Prisma.Sql[] = [
    Prisma.sql`"contentType" = 'PARISH'::"ChecklistContentType"`,
    Prisma.sql`"isPublished"`,
    Prisma.sql`"latitude" BETWEEN ${latitude - dLat} AND ${latitude + dLat}`,
  ];
  // Near a pole (or with a huge radius) the box spans every meridian, and near
  // the antimeridian it would wrap; in both cases drop the longitude bound and
  // let the distance ordering do the work.
  if (dLng < 180 && longitude - dLng >= -180 && longitude + dLng <= 180) {
    filters.push(Prisma.sql`"longitude" BETWEEN ${longitude - dLng} AND ${longitude + dLng}`);
  }
  const where = Prisma.join(filters, " AND ");

  const distance = Prisma.sql`
    ${EARTH_RADIUS_MILES} * acos(least(1, greatest(-1,
      sin(radians(${latitude})) * sin(radians("latitude")) +
      cos(radians(${latitude})) * cos(radians("latitude")) *
      cos(radians("longitude") - radians(${longitude}))
    )))`;

  const rows = await prisma.$queryRaw<ParishRow[]>(
    Prisma.sql`SELECT ${PARISH_COLUMNS}, ${distance} AS "distance_miles"
               FROM "PublishedContent"
               WHERE ${where}
               ORDER BY "distance_miles" ASC
               LIMIT ${take}`,
  );
  return rows.filter((r) => (r.distance_miles ?? 0) <= radiusMiles).map(toParishItem);
}

/* -------------------------------------------------------------------------
 * Homepage featured prayers
 * ---------------------------------------------------------------------- */

export interface FeaturedPrayerItem {
  id: string;
  slug: string;
  title: string;
  /** Canonical category value (see prayer-categories.ts). */
  category: string;
  /** Human label for that category — never a raw stored string. */
  categoryLabel: string;
  href: string;
}

/**
 * Six prayers for the homepage rail, rotating once a day.
 *
 * The rail used to be `listPublished("PRAYER").slice(0, 6)` — every prayer
 * body loaded to render six titles, always the same six (alphabetically
 * first). The order here is `md5(id || dayKey)`, which is deterministic for a
 * given day (so a reload does not reshuffle and SSR matches), different every
 * day, and computed in SQL over an already-projected read. The site therefore
 * cycles its own content with the worker switched off.
 */
export async function listFeaturedPrayers(
  dayKey: string,
  count = 6,
): Promise<FeaturedPrayerItem[]> {
  const take = Math.min(Math.max(Math.trunc(Number(count)) || 6, 1), 24);
  const key = dayKey && dayKey.trim() ? dayKey.trim() : new Date().toISOString().slice(0, 10);
  return memo(`featured-prayers:${key}:${take}`, MEMO_TTL.daily, async () => {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        slug: string;
        title: string;
        subtype: string | null;
        category: string | null;
      }>
    >(Prisma.sql`
      SELECT "id", "slug", "title", "subtype", payload->>'category' AS "category"
      FROM "PublishedContent"
      WHERE "contentType" = 'PRAYER'::"ChecklistContentType" AND "isPublished"
      ORDER BY md5("id" || ${key})
      LIMIT ${take}`);
    return rows.map((row) => {
      const category = categorizePrayer({
        title: row.title,
        prayerType: row.subtype,
        category: row.category,
      });
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        category,
        categoryLabel: prayerCategoryLabel(category),
        href: publicRouteFor("PRAYER", row.slug).slugPath,
      };
    });
  });
}

/* -------------------------------------------------------------------------
 * Search
 *
 * Search used to be `ILIKE '%q%'` over title and slug with no ranking and no
 * ordering: "st john" missed "Saint John", "mary" returned fifty rows in heap
 * order, and the header dropdown's alphabetical first-120 window was filled by
 * saints and parishes so smaller groups never appeared at all.
 *
 * Migration 0055 adds a weighted tsvector (title > subtitle > payload prose)
 * with a GIN index, and — when the extension is available — a trigram index on
 * title. Both are optional: the capability probe below decides at runtime what
 * this database can do, and everything degrades to the original predicate
 * rather than failing, because a search box that returns nothing is worse than
 * a slow one.
 * ---------------------------------------------------------------------- */

export interface SearchHit {
  id: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  subtitle: string;
  /** Human type label ("Our Lady", "Church Document") — never the raw enum. */
  typeLabel: string;
  /** Canonical public path for the hit. */
  href: string;
  /** Relevance score; higher is better. 0 on the non-indexed fallback path. */
  rank: number;
}

export interface SearchResultGroup {
  contentType: ChecklistContentType;
  label: string;
  items: SearchHit[];
}

export interface SearchResults {
  query: string;
  /** Total matches in the database, not the number returned. */
  total: number;
  hits: SearchHit[];
  /** The same hits grouped by content type, best group first. */
  groups: SearchResultGroup[];
  page: number;
  pageSize: number;
  pageCount: number;
  /** True when the indexed path ran; false on the ILIKE fallback. */
  indexed: boolean;
}

type SearchCapabilities = { vector: boolean; trigram: boolean };

/**
 * What this database can actually do. Probed once an hour rather than assumed,
 * because Railway's managed Postgres may refuse `CREATE EXTENSION pg_trgm`
 * (migration 0055 swallows that) and a database restored from an older dump
 * may not have the column at all.
 */
async function searchCapabilities(): Promise<SearchCapabilities> {
  return memo("search-capabilities", MEMO_TTL.sitemap, async () => {
    try {
      const rows = await prisma.$queryRaw<Array<{ vector: boolean; trigram: boolean }>>(
        Prisma.sql`SELECT
          EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'PublishedContent' AND column_name = 'searchVector') AS "vector",
          EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS "trigram"`,
      );
      return { vector: Boolean(rows[0]?.vector), trigram: Boolean(rows[0]?.trigram) };
    } catch {
      // No probe, no indexed search — fall back rather than fail.
      return { vector: false, trigram: false };
    }
  });
}

/**
 * Turn a user's words into a `to_tsquery` string: every token ANDed, the last
 * one prefix-matched so the header dropdown responds while the visitor is
 * still typing ("mar" finds Mary). Tokens are reduced to letters and digits,
 * which is also what makes interpolating them into to_tsquery safe. Hyphens
 * and slashes become spaces so a pasted slug ("our-father") searches as words.
 */
export function toTsQueryText(query: string, prefixLastTerm = true): string {
  const tokens = query.replace(/[-_/]+/g, " ").match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return "";
  return tokens
    .map((t, i) => (prefixLastTerm && i === tokens.length - 1 ? `${t}:*` : t))
    .join(" & ");
}

/** Rows every search query projects (no payload). */
const SEARCH_COLUMNS = Prisma.sql`"id", "contentType", "slug", "title", "subtitle", "subtype"`;

type SearchRow = {
  id: string;
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  subtype: string | null;
  rank?: number | null;
};

function toSearchHit(row: SearchRow): SearchHit {
  return {
    id: row.id,
    contentType: row.contentType,
    slug: row.slug,
    title: row.title,
    subtitle: projectedSubtitle({
      contentType: row.contentType,
      title: row.title,
      subtitle: row.subtitle,
      subtype: row.subtype,
    }),
    typeLabel: contentTypeLabel(row.contentType, row.subtype),
    href: publicRouteFor(row.contentType, row.slug).slugPath,
    rank: Number(row.rank ?? 0),
  };
}

/**
 * The indexed match predicate and its ranking expression.
 *
 * Rank combines full-text relevance with two title signals a visitor expects:
 * an exact title match wins outright, and a title that starts with what they
 * typed beats one that merely mentions it. Trigram similarity is added only
 * where pg_trgm exists, so a typo ("Aquinis") still finds Aquinas there and
 * simply does not on a database without the extension.
 */
function searchSql(
  query: string,
  caps: SearchCapabilities,
  opts: { prefixLastTerm?: boolean } = {},
) {
  // Prefix-expanding the last term is what makes the header dropdown answer
  // while the visitor is still typing ("mar" → Mary). On the results page it
  // is the wrong trade: the expansion matches every lexeme sharing the stem,
  // which floats obscure near-spellings above the thing that was asked for.
  const tsq = toTsQueryText(query, opts.prefixLastTerm ?? false);
  const prefix = `${query.trim()}%`;
  const tsquery = Prisma.sql`to_tsquery('english', ${tsq})`;
  const similarity = caps.trigram
    ? Prisma.sql`+ similarity("title", ${query.trim()})`
    : Prisma.empty;
  const trigramMatch = caps.trigram ? Prisma.sql`OR "title" % ${query.trim()}` : Prisma.empty;
  // A title that contains the typed words as WHOLE words outranks one that
  // merely shares a prefix — without it "mary" ranked "Marie-Catherine
  // Troiani" above "Hail Mary", because the trailing `:*` expansion matches
  // many lexemes. The pattern is built from letters, digits and spaces only,
  // so there is nothing for a regex metacharacter to do.
  const wordSafe = query
    .trim()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordBoundary = wordSafe
    ? Prisma.sql`+ CASE WHEN "title" ~* ${`\y${wordSafe}\y`} THEN 2 ELSE 0 END`
    : Prisma.empty;
  const rank = Prisma.sql`(
    ts_rank_cd("searchVector", ${tsquery})
    + CASE WHEN lower("title") = lower(${query.trim()}) THEN 3 ELSE 0 END
    + CASE WHEN "title" ILIKE ${prefix} THEN 1 ELSE 0 END
    ${wordBoundary}
    ${similarity}
  )`;
  const where = Prisma.sql`"isPublished" AND (
    "searchVector" @@ ${tsquery}
    OR "title" ILIKE ${prefix}
    ${trigramMatch}
  )`;
  return { rank, where, hasTerms: tsq.length > 0 };
}

/** The original unindexed predicate, kept as the fallback path. */
async function searchFallback(query: string, limit: number, offset: number): Promise<SearchRow[]> {
  const rows = await prisma.publishedContent.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { slug: { contains: query.toLowerCase(), mode: "insensitive" } },
      ],
    },
    select: { ...LIST_SELECT },
    orderBy: { title: "asc" },
    skip: offset,
    take: limit,
  });
  return rows;
}

/**
 * A page of search results, ranked, with the true total and a grouping by
 * content type. The results page used to report `hits.length` (capped at 50)
 * as the total and print raw enum names as labels.
 */
export async function searchPublishedPage(
  query: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchResults> {
  const q = query.trim();
  const page = clampPage(opts.page);
  const pageSize = clampPageSize(opts.pageSize ?? 25);
  const offset = (page - 1) * pageSize;
  const empty: SearchResults = {
    query: q,
    total: 0,
    hits: [],
    groups: [],
    page,
    pageSize,
    pageCount: 1,
    indexed: false,
  };
  if (!q) return empty;

  const caps = await searchCapabilities();
  let rows: SearchRow[] = [];
  let total = 0;
  let indexed = false;

  if (caps.vector) {
    try {
      const { rank, where } = searchSql(q, caps);
      const [countRows, hitRows] = await Promise.all([
        prisma.$queryRaw<Array<{ total: bigint }>>(
          Prisma.sql`SELECT count(*)::bigint AS total FROM "PublishedContent" WHERE ${where}`,
        ),
        prisma.$queryRaw<SearchRow[]>(
          Prisma.sql`SELECT ${SEARCH_COLUMNS}, ${rank} AS "rank"
                     FROM "PublishedContent"
                     WHERE ${where}
                     ORDER BY "rank" DESC, "title" ASC
                     LIMIT ${pageSize} OFFSET ${offset}`,
        ),
      ]);
      total = Number(countRows[0]?.total ?? 0);
      rows = hitRows;
      indexed = true;
    } catch {
      // A malformed tsquery or a half-applied migration must not break search.
      indexed = false;
    }
  }

  if (!indexed) {
    rows = await searchFallback(q, pageSize, offset);
    total = await prisma.publishedContent
      .count({
        where: {
          isPublished: true,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q.toLowerCase(), mode: "insensitive" } },
          ],
        },
      })
      .catch(() => rows.length);
  }

  // A pasted slug that matched nothing as words is still worth one exact
  // lookup — cheap, and it keeps "our-father" working as a query.
  if (rows.length === 0 && /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(q.toLowerCase())) {
    const exact = await prisma.publishedContent.findFirst({
      where: { slug: q.toLowerCase(), isPublished: true },
      select: { ...LIST_SELECT },
    });
    if (exact) {
      rows = [exact];
      total = 1;
    }
  }

  const hits = rows.map(toSearchHit);
  const grouped = new Map<ChecklistContentType, SearchHit[]>();
  for (const hit of hits) {
    const arr = grouped.get(hit.contentType) ?? [];
    arr.push(hit);
    grouped.set(hit.contentType, arr);
  }
  const groups: SearchResultGroup[] = [...grouped.entries()].map(([contentType, items]) => ({
    contentType,
    // The first hit's own label already accounts for its subtype (Litany).
    label: items[0]?.typeLabel ?? contentTypeLabel(contentType),
    items,
  }));

  return {
    query: q,
    total,
    hits,
    groups,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    indexed,
  };
}

/**
 * Flat, ranked search results. Signature kept from the original so the search
 * page and the worker's post-publish search verifier keep working; the return
 * rows are now a projection with a human `typeLabel` and a ready `href`
 * instead of full payloads.
 */
export async function searchPublished(query: string, limit = 20): Promise<SearchHit[]> {
  if (!query.trim()) return [];
  const pageSize = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), MAX_PAGE_SIZE);
  const results = await searchPublishedPage(query, { page: 1, pageSize });
  return results.hits;
}

/** Every content type, for the per-group suggestion query. */
const ALL_CONTENT_TYPES = Object.keys(CONTENT_TYPE_TO_SUGGEST_GROUP) as ChecklistContentType[];

/**
 * Autocomplete suggestions for the header search, balanced across groups.
 *
 * The old implementation took the alphabetically first 120 matches and then
 * grouped them, so for "mar" the window filled with saints and parishes and
 * the Marian titles, devotions and prayers never appeared. This asks each
 * content type for its own best `perGroup` rows via a LATERAL join, so every
 * group that has a match contributes one — and each of those little queries
 * uses the same indexes as the main search.
 */
export async function suggestPublished(query: string, perGroup = 3): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(Math.trunc(Number(perGroup)) || 3, 1), 10);
  const caps = await searchCapabilities();

  let rows: SearchRow[] = [];
  if (caps.vector) {
    try {
      const { rank, where } = searchSql(q, caps, { prefixLastTerm: true });
      rows = await prisma.$queryRaw<SearchRow[]>(
        Prisma.sql`
          SELECT s.* FROM unnest(${ALL_CONTENT_TYPES}::text[]) AS t(ct)
          CROSS JOIN LATERAL (
            SELECT ${SEARCH_COLUMNS}, ${rank} AS "rank"
            FROM "PublishedContent"
            WHERE "contentType" = t.ct::"ChecklistContentType" AND ${where}
            ORDER BY "rank" DESC, "title" ASC
            LIMIT ${limit}
          ) s
          ORDER BY s."rank" DESC, s."title" ASC`,
      );
    } catch {
      rows = [];
    }
  }
  if (rows.length === 0) {
    // Fallback: the original predicate, but capped per group in JS so small
    // groups still surface.
    const fallback = await searchFallback(q, 200, 0);
    const seen = new Map<ChecklistContentType, number>();
    rows = fallback.filter((row) => {
      const n = seen.get(row.contentType) ?? 0;
      if (n >= limit) return false;
      seen.set(row.contentType, n + 1);
      return true;
    });
  }

  return rows.map((row) => ({
    group: CONTENT_TYPE_TO_SUGGEST_GROUP[row.contentType] ?? "prayers",
    id: row.id,
    slug: row.slug,
    label: row.title,
    subtitle: projectedSubtitle({
      contentType: row.contentType,
      title: row.title,
      subtitle: row.subtitle,
      subtype: row.subtype,
    }),
    typeLabel: contentTypeLabel(row.contentType, row.subtype),
    href: publicRouteFor(row.contentType, row.slug).slugPath,
  }));
}
