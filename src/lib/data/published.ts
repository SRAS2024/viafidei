/**
 * Public-facing data access — reads from the PublishedContent table
 * written by the checklist-first worker.
 *
 * Every public page on the site goes through these helpers; there is no
 * other path from the database to the public site.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ChecklistContentType } from "@prisma/client";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import {
  OLD_TESTAMENT_BEFORE_YEAR,
  OLD_TESTAMENT_SAINTS,
  SAINT_DISPLAY_RANK,
  SAINT_DUPLICATE_OF,
  compareSaintsChronologically,
  saintCardDetails,
  type SaintCardDetails,
} from "@/lib/content-shared/saints";
import { accentBlindPattern, parishDisplayName } from "@/lib/content-shared/parish";
import { categorizePrayer, prayerCategoryLabel } from "@/lib/content-shared/prayer-categories";
import { MAX_PAGE_NUMBER } from "@/lib/content-shared/list-page";
import {
  MAX_QUERY_WORDS,
  normalizeSearchText,
  parseSearchQuery,
} from "@/lib/content-shared/list-search";
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
  /**
   * The indexed feast columns, which the lists, the feast-day pages and search read. A
   * page shows the feast from these too, so it cannot disagree with the list that led
   * to it when an older payload still holds another date.
   */
  feastMonth?: number | null;
  feastDayOfMonth?: number | null;
}

/** A row's title as a reader sees it: a church's may hold the raw list of its names. */
function readerTitle(row: { contentType: ChecklistContentType; title: string }): string {
  return row.contentType === "PARISH" ? parishDisplayName(row.title) : row.title;
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
    title: readerTitle(row),
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
    feastMonth: (row as { feastMonth?: number | null }).feastMonth ?? null,
    feastDayOfMonth: (row as { feastDayOfMonth?: number | null }).feastDayOfMonth ?? null,
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
  // Memoised, because thirteen `force-dynamic` list pages call this on EVERY
  // request and none of them was cached: /prayers loaded every published
  // prayer's full body and translations per visitor just to build filter chips
  // and slice one page. The 60 s list TTL is the same tier the sitemap and
  // suggestion paths already use, and the publish path flushes the memo.
  return memo(`published:list:${contentType}`, MEMO_TTL.list, async () => {
    const rows = await prisma.publishedContent.findMany({
      where: { contentType, isPublished: true },
      orderBy: { title: "asc" },
    });
    return rows.map((row) => deserialize(row)!).filter(Boolean);
  });
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
 * Several published items of one type, by slug, in ONE query — returned in the
 * order the slugs were given, with unknown or unpublished slugs dropped and
 * duplicates collapsed. The pages that list a set of prayers (a guide's, a
 * novena's, a devotion's) used to issue one query per prayer.
 *
 * Memoised on the list tier: the same handful of sets (the Rosary's prayers,
 * the building-block prayers every prayer page checks) is requested on every
 * view, and the publish path flushes the memo.
 */
export async function listPublishedBySlugs(
  contentType: ChecklistContentType,
  slugs: ReadonlyArray<string>,
): Promise<PublishedItem[]> {
  const wanted = [...new Set(slugs.filter((s) => typeof s === "string" && s.trim()))];
  if (wanted.length === 0) return [];
  const items = await memo(
    `published:by-slugs:${contentType}:${wanted.join(",")}`,
    MEMO_TTL.list,
    async () => {
      const rows = await prisma.publishedContent.findMany({
        where: { contentType, slug: { in: wanted }, isPublished: true },
      });
      return rows.map((row) => deserialize(row)!).filter(Boolean);
    },
  );
  const bySlug = new Map(items.map((item) => [item.slug, item]));
  return wanted.map((slug) => bySlug.get(slug)).filter((i): i is PublishedItem => i != null);
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
 * site title and the browser's default page icon. A missing item is the page's
 * not-found state: metadata goes out with the first bytes, so this is what gives the
 * response a not-found title and noindex. It still answers 200, not 404, because the
 * [slug]/loading.tsx boundary flushes before the not-found takes effect.
 */
export function buildPublishedMetadata(item: PublishedItem | null): Metadata {
  if (!item) notFound();
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
 *   - `saints`        the saint list's own order (`orderSqlFor`), one record per person
 */
export type PublishedOrder = "title" | "chronological" | "feast" | "saints";

export const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function clampPage(page: number | undefined): number {
  const n = Math.trunc(Number(page ?? 1));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PAGE_NUMBER) : 1;
}

/**
 * A list read at the page a link asked for, or at its last page when the list ends
 * before it. A stale or hand-made `?page=` then shows the last page, as the lists
 * paged in memory do, and not an empty list saying there is nothing here at all.
 * The second read happens only for a page past the end, so a normal page costs one.
 */
async function readUpToLastPage<T>(
  page: number,
  read: (page: number) => Promise<PublishedPage<T>>,
): Promise<PublishedPage<T>> {
  const result = await read(page);
  return result.total > 0 && page > result.pageCount ? read(result.pageCount) : result;
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
    case "saints": // Which Prisma cannot express: its rows are read in raw SQL.
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
 *
 * `q` narrows the page to the rows of this type that match a search (see
 * `searchPublishedTypePage`), best match first; the subtype filter and the
 * paging still apply.
 */
export async function listPublishedPage(
  contentType: ChecklistContentType,
  opts: {
    page?: number;
    pageSize?: number;
    subtype?: string | ReadonlyArray<string> | null;
    order?: PublishedOrder;
    q?: string | null;
  } = {},
): Promise<PublishedPage<PublishedListItem>> {
  const pageSize = clampPageSize(opts.pageSize);
  const order = opts.order ?? "title";
  const subtypes =
    opts.subtype == null ? null : Array.isArray(opts.subtype) ? [...opts.subtype] : [opts.subtype];
  const q = parseSearchQuery(opts.q);

  return readUpToLastPage(clampPage(opts.page), async (page) => {
    if (q) return searchPublishedTypePage(contentType, { page, pageSize, subtypes, order, q });
    if (order === "saints") return saintOrderPage(contentType, { page, pageSize, subtypes });

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
  });
}

/** `ORDER BY` text for a list order, for the raw-SQL search path. */
function orderSqlFor(order: PublishedOrder): Prisma.Sql {
  switch (order) {
    case "chronological":
      return Prisma.sql`"sortYear" ASC NULLS LAST, "title" ASC`;
    case "feast":
      return Prisma.sql`"feastMonth" ASC NULLS LAST, "feastDayOfMonth" ASC NULLS LAST, "title" ASC`;
    case "saints":
      // Those the list names, in its order; then everyone else by year, the
      // undated last; then the Old Testament, named ones first. Needs
      // `saintRankJoin`. The slug settles a tie, so an offset never repeats a row.
      return Prisma.sql`
        CASE
          WHEN "listRank" < ${OLD_TESTAMENT_RANK} THEN 0
          WHEN "listRank" IS NOT NULL OR "sortYear" < ${OLD_TESTAMENT_BEFORE_YEAR} THEN 2
          ELSE 1
        END,
        "listRank" ASC NULLS LAST,
        "sortYear" ASC NULLS LAST,
        "title" ASC,
        "slug" ASC`;
    default:
      return Prisma.sql`"title" ASC`;
  }
}

/** Where the named Old Testament saints start among the list's ranks. */
const OLD_TESTAMENT_RANK = 1_000_000;

const SAINT_RANK_SLUGS = [...SAINT_DISPLAY_RANK.keys(), ...OLD_TESTAMENT_SAINTS];
const SAINT_RANK_VALUES = [
  ...SAINT_DISPLAY_RANK.values(),
  ...OLD_TESTAMENT_SAINTS.map((_, index) => OLD_TESTAMENT_RANK + index),
];

/**
 * The join that gives each row its `listRank`. A hash join against a few hundred
 * ranks, where `array_position` would compare every saint to every rank.
 */
function saintRankJoin(): Prisma.Sql {
  return Prisma.sql`LEFT JOIN unnest(${SAINT_RANK_SLUGS}::text[], ${SAINT_RANK_VALUES}::int[])
    AS "saintRank"("rankSlug", "listRank") ON "saintRank"."rankSlug" = "slug"`;
}

/**
 * The records a reader is not shown because the same person has a better one live:
 * not in the saint list, on a feast, in search or in the sitemap. Only a duplicate
 * whose canonical record is published is hidden, so a saint can never vanish.
 * Fail-open: a failed read hides nothing.
 */
function liveSaintDuplicates(): Promise<{
  slugs: string[];
  names: Array<{ name: string; canonical: string }>;
}> {
  return memo("saints:hidden-duplicates", MEMO_TTL.list, async () => {
    try {
      const rows = await prisma.publishedContent.findMany({
        where: {
          contentType: "SAINT",
          isPublished: true,
          slug: { in: [...Object.keys(SAINT_DUPLICATE_OF), ...Object.values(SAINT_DUPLICATE_OF)] },
        },
        select: { slug: true, title: true },
      });
      const live = new Set(rows.map((row) => row.slug));
      return {
        slugs: Object.keys(SAINT_DUPLICATE_OF).filter((slug) =>
          live.has(SAINT_DUPLICATE_OF[slug]!),
        ),
        names: rows.flatMap(({ slug, title }) => {
          const canonical = SAINT_DUPLICATE_OF[slug];
          return canonical && live.has(canonical) ? [{ name: title, canonical }] : [];
        }),
      };
    } catch {
      return { slugs: [], names: [] };
    }
  });
}

export async function hiddenDuplicateSaints(): Promise<string[]> {
  return (await liveSaintDuplicates()).slugs;
}

/** Whether a name holds the words typed, the last perhaps still being typed. */
function nameAnswers(name: string, query: string): boolean {
  const nameWords = normalizeSearchText(name).split(" ");
  const typed = normalizeSearchText(query).split(" ").filter(Boolean);
  return (
    typed.length > 0 &&
    typed.every((word, i) =>
      nameWords.some((w) => (i === typed.length - 1 ? w.startsWith(word) : w === word)),
    )
  );
}

/**
 * What a search must know of the saints published twice. The hidden records stay out,
 * but their names still lead to the saint: a reader who knows Saint Damien of Molokai as
 * "Father Damien" must find him, though only the hidden record says so. A search for a
 * hidden record's whole name leads with the saint, as it would have led with the record.
 */
async function saintDuplicatesFor(query: string): Promise<{
  hidden: readonly string[];
  named: readonly string[];
  exactlyNamed: readonly string[];
}> {
  const { slugs, names } = await liveSaintDuplicates();
  const answering = names.filter(({ name }) => nameAnswers(name, query));
  const exact = normalizeSearchText(query);
  return {
    hidden: slugs,
    named: answering.map(({ canonical }) => canonical),
    exactlyNamed: answering
      .filter(({ name }) => normalizeSearchText(name) === exact)
      .map(({ canonical }) => canonical),
  };
}

type SaintDuplicates = Awaited<ReturnType<typeof saintDuplicatesFor>>;

/** The row is a saint, one of these. */
function isSaintAmong(slugs: readonly string[]): Prisma.Sql {
  return Prisma.sql`("contentType" = 'SAINT'::"ChecklistContentType" AND "slug" = ANY(${[...slugs]}::text[]))`;
}

/** One page of rows in the saint list's order, with the true count of the filter. */
async function saintOrderRows(
  filters: Prisma.Sql[],
  opts: { page: number; pageSize: number },
): Promise<PublishedPage<PublishedListItem>> {
  const { page, pageSize } = opts;
  const hidden = await hiddenDuplicateSaints();
  const where = Prisma.join([...filters, Prisma.sql`"slug" <> ALL(${hidden}::text[])`], " AND ");
  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`SELECT count(*)::bigint AS total FROM "PublishedContent" WHERE ${where}`,
    ),
    prisma.$queryRaw<SearchRow[]>(
      Prisma.sql`SELECT ${SEARCH_COLUMNS}
                 FROM "PublishedContent" ${saintRankJoin()}
                 WHERE ${where}
                 ORDER BY ${orderSqlFor("saints")}
                 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  return {
    items: rows.map(toListItem),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** The saint list with no search: every published record of the type and filter. */
function saintOrderPage(
  contentType: ChecklistContentType,
  opts: { page: number; pageSize: number; subtypes: string[] | null },
): Promise<PublishedPage<PublishedListItem>> {
  const filters: Prisma.Sql[] = [
    Prisma.sql`"contentType" = ${contentType}::"ChecklistContentType"`,
    Prisma.sql`"isPublished"`,
  ];
  if (opts.subtypes && opts.subtypes.length > 0) {
    filters.push(Prisma.sql`"subtype" = ANY(${opts.subtypes})`);
  }
  return saintOrderRows(filters, opts);
}

/** A user's text made literal inside a LIKE pattern. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** "Saint" and "St." are one word in a title: either finds both. */
const SAINT_TSQUERY: Readonly<Record<string, string>> = {
  saint: "(saint | st)",
  st: "(saint | st)",
  saints: "(saints | sts)",
  sts: "(saints | sts)",
};

/**
 * A list-page query as `to_tsquery` text: every word required, every word
 * prefix-matched (a list is filtered as the reader types whole or partial
 * words: "fran assisi" finds Francis of Assisi), and "saint"/"st" as one
 * word. Words are letters and digits only, which is what makes interpolating
 * them into to_tsquery safe. An apostrophe joins rather than splits ("Peter's"
 * is one word, which English stemming reads as "peter").
 */
export function toListTsQueryText(query: string): string {
  const tokens = query
    .replace(/['’ʼ`]/g, "")
    .replace(/[-_/]+/g, " ")
    .match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return "";
  return tokens
    .slice(0, MAX_QUERY_WORDS)
    .map((token) => SAINT_TSQUERY[token.toLowerCase()] ?? `${token}:*`)
    .join(" & ");
}

/** The same two words for a regular expression, with the full stop of "St.". */
const SAINT_PATTERN: Readonly<Record<string, string>> = {
  saint: String.raw`(?:saint|st\.?)`,
  st: String.raw`(?:saint|st\.?)`,
  saints: String.raw`(?:saints|sts\.?)`,
  sts: String.raw`(?:saints|sts\.?)`,
};

/**
 * A POSIX regular expression for a title holding the query's words together, as
 * whole words, with "Saint" and "St." as one word, as the search itself reads them.
 * A leading "Saint" is optional, because a name need not say it: "John the Apostle"
 * answers "st john". Null when the query has no letters or digits. The rest of the
 * pattern is built from letters, digits and spaces only, so there is nothing for a
 * metacharacter to do.
 */
function titleWordsPattern(query: string): string | null {
  const words = query
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words.map((word) => SAINT_PATTERN[word.toLowerCase()] ?? word);
  const leading = words.length > 1 && SAINT_PATTERN[words[0]!.toLowerCase()];
  const body = leading ? `(?:${leading} )?${pattern.slice(1).join(" ")}` : pattern.join(" ");
  // String.raw, because `\y` is not a JavaScript escape: in a plain template literal
  // it collapses to a bare `y`. Postgres needs the backslash for its word boundary.
  return String.raw`\y${body}\y`;
}

/**
 * The rows of one content type that match a list page's search, best first,
 * one page at a time.
 *
 * Indexed path: the weighted search vector (title, subtitle, and the payload
 * prose and facts migration 0055 folds in, a saint's patronages among them),
 * plus any title containing the query as typed and, where pg_trgm exists, a
 * title within typo distance. Rows are ranked as the site search ranks them —
 * an exact title, then a title that starts with the query, then whole-word
 * title matches — with a title that contains the query lifted above prose
 * matches; ties keep the list's own order.
 *
 * Fallback (no search vector, or a query the database refuses): every word
 * must appear in the title or subtitle, in the list's own order.
 */
async function searchPublishedTypePage(
  contentType: ChecklistContentType,
  opts: {
    page: number;
    pageSize: number;
    subtypes: string[] | null;
    order: PublishedOrder;
    q: string;
  },
): Promise<PublishedPage<PublishedListItem>> {
  const { page, pageSize, subtypes, order, q } = opts;
  const offset = (page - 1) * pageSize;
  const caps = await searchCapabilities();

  if (caps.vector) {
    try {
      const tsquery = Prisma.sql`to_tsquery('english', ${toListTsQueryText(q)})`;
      const contains = `%${escapeLike(q)}%`;
      // A search of the saint list shows each person once, as the list does.
      const saints = order === "saints";
      const duplicates = saints ? await saintDuplicatesFor(q) : null;
      const filters: Prisma.Sql[] = [
        Prisma.sql`"contentType" = ${contentType}::"ChecklistContentType"`,
        Prisma.sql`"isPublished"`,
        Prisma.sql`("searchVector" @@ ${tsquery} OR "title" ILIKE ${contains}${
          caps.trigram ? Prisma.sql` OR "title" % ${q}` : Prisma.empty
        }${duplicates ? Prisma.sql` OR ${isSaintAmong(duplicates.named)}` : Prisma.empty})`,
      ];
      if (subtypes && subtypes.length > 0) filters.push(Prisma.sql`"subtype" = ANY(${subtypes})`);
      if (duplicates) filters.push(Prisma.sql`"slug" <> ALL(${[...duplicates.hidden]}::text[])`);
      const where = Prisma.join(filters, " AND ");
      const rank = Prisma.sql`(${searchRank(q, tsquery, caps, duplicates)}
        + CASE WHEN "title" ILIKE ${contains} THEN 1 ELSE 0 END)`;
      // "Mary" means Our Lady before it means Mary of Clopas, and "John" the
      // Apostle before John I of Milan: a saint the list names, whose name has
      // the words typed, keeps her place in the list ahead of the closest match.
      const wholeWords = titleWordsPattern(q);
      const namedFirst =
        saints && wholeWords
          ? Prisma.sql`CASE WHEN "listRank" < ${OLD_TESTAMENT_RANK}
                         AND "title" ~* ${wholeWords} THEN "listRank" END
                       ASC NULLS LAST, `
          : Prisma.empty;
      const [countRows, rows] = await Promise.all([
        prisma.$queryRaw<Array<{ total: bigint }>>(
          Prisma.sql`SELECT count(*)::bigint AS total FROM "PublishedContent" WHERE ${where}`,
        ),
        prisma.$queryRaw<SearchRow[]>(
          Prisma.sql`SELECT ${SEARCH_COLUMNS}, ${rank} AS "rank"
                     FROM "PublishedContent" ${saints ? saintRankJoin() : Prisma.empty}
                     WHERE ${where}
                     ORDER BY ${namedFirst}"rank" DESC, ${orderSqlFor(order)}
                     LIMIT ${pageSize} OFFSET ${offset}`,
        ),
      ]);
      const total = Number(countRows[0]?.total ?? 0);
      return {
        items: rows.map(toListItem),
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      };
    } catch {
      // A half-applied migration or a query to_tsquery refuses must not take
      // the page down: fall through to the plain predicate.
    }
  }

  const words = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, MAX_QUERY_WORDS) ?? [];
  if (order === "saints") {
    const filters: Prisma.Sql[] = [
      Prisma.sql`"contentType" = ${contentType}::"ChecklistContentType"`,
      Prisma.sql`"isPublished"`,
    ];
    if (subtypes && subtypes.length > 0) filters.push(Prisma.sql`"subtype" = ANY(${subtypes})`);
    if (words.length === 0) {
      filters.push(Prisma.sql`FALSE`);
    } else {
      const everyWord = words.map((word) => {
        const like = `%${escapeLike(word)}%`;
        return Prisma.sql`("title" ILIKE ${like} OR "subtitle" ILIKE ${like})`;
      });
      const { named } = await saintDuplicatesFor(q);
      filters.push(
        Prisma.sql`((${Prisma.join(everyWord, " AND ")}) OR "slug" = ANY(${[...named]}::text[]))`,
      );
    }
    return saintOrderRows(filters, { page, pageSize });
  }
  const where: Prisma.PublishedContentWhereInput = {
    contentType,
    isPublished: true,
    ...(subtypes && subtypes.length > 0 ? { subtype: { in: subtypes } } : {}),
    // No words at all ("!!!") matches nothing, as the indexed path does.
    AND:
      words.length > 0
        ? words.map((word) => ({
            OR: [
              { title: { contains: word, mode: "insensitive" as const } },
              { subtitle: { contains: word, mode: "insensitive" as const } },
            ],
          }))
        : [{ id: { in: [] } }],
  };
  const [total, rows] = await Promise.all([
    prisma.publishedContent.count({ where }),
    prisma.publishedContent.findMany({
      where,
      select: LIST_SELECT,
      orderBy: orderByFor(order),
      skip: offset,
      take: pageSize,
    }),
  ]);
  return {
    items: rows.map(toListItem),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
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

interface SaintCardRow {
  id: string;
  patronages: unknown;
  patronage: string | null;
  feastDay: string | null;
  feastMonth: number | null;
  feastDayOfMonth: number | null;
}

/**
 * Patronage + feast for the saints on one catalogue page, keyed by id. The page
 * itself comes from `listPublishedPage`, which projects the payload away (the
 * type is heading for 10,000 rows), so a card's two detail lines come from this
 * second, primary-key-bounded query that pulls only those JSON fields — the
 * same projection the parish directory uses — instead of thirty full payloads.
 */
export async function listSaintCardDetails(
  ids: readonly string[],
): Promise<Map<string, SaintCardDetails>> {
  const out = new Map<string, SaintCardDetails>();
  if (ids.length === 0) return out;
  const rows = await prisma.$queryRaw<SaintCardRow[]>(
    Prisma.sql`SELECT "id",
                      payload->'patronages' AS "patronages",
                      payload->>'patronage' AS "patronage",
                      payload->>'feastDay'  AS "feastDay",
                      "feastMonth", "feastDayOfMonth"
                 FROM "PublishedContent"
                WHERE "id" = ANY(${[...ids]})
                  AND "contentType" = 'SAINT'::"ChecklistContentType"`,
  );
  // The same reading the saint's own page applies to its full payload, so the
  // card and the page can never disagree about a patronage or a feast.
  for (const row of rows) out.set(row.id, saintCardDetails(row));
  return out;
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
    // The same person is one card, as on the saint list: a duplicate whose better record
    // is live is hidden here too, even when the two records keep different feasts.
    const live = new Set(rows.map((row) => row.slug));
    const hidden = new Set(await hiddenDuplicateSaints());
    return rows
      .filter((row) => !live.has(SAINT_DUPLICATE_OF[row.slug] ?? "") && !hidden.has(row.slug))
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
  /** Street address on its own — the card prints the place parts separately. */
  address: string | null;
  /** Postal code, when the record has one; the card places it by country. */
  postalCode: string | null;
  /** Parish website, when the record has one. */
  website: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  /** ISO 3166-1 alpha-2 code, when the record has one. */
  countryCode: string | null;
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
  postalCode?: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode?: string | null;
  website: string | null;
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
    title: parishDisplayName(row.title),
    subtitle: projectedSubtitle({
      contentType: "PARISH",
      title: row.title,
      subtitle: row.subtitle,
      subtype: row.subtype,
    }),
    designation,
    location,
    address: row.address ?? null,
    postalCode: row.postalCode ?? null,
    website: row.website ?? null,
    city: row.city,
    state: row.state,
    country: row.country,
    countryCode: row.countryCode ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    href: publicRouteFor("PARISH", row.slug).slugPath,
    ...(row.distance_miles == null ? {} : { distanceMiles: Number(row.distance_miles) }),
  };
}

/** The projected columns every parish list query returns. */
const PARISH_COLUMNS = Prisma.sql`
  "id", "slug", "title", "subtitle", "subtype", "latitude", "longitude",
  payload->>'address'     AS "address",
  payload->>'postalCode'  AS "postalCode",
  payload->>'city'        AS "city",
  payload->>'state'       AS "state",
  payload->>'country'     AS "country",
  payload->>'countryCode' AS "countryCode",
  payload->>'website'     AS "website"
`;

/**
 * The words of a directory search, whichever way the reader's keyboard wrote their
 * accents. A mark stays with its word: Yoruba's "ẹ́" and the vowels of Hindi and Thai
 * are a letter and a mark even when composed, and are not two words.
 */
function parishWords(q: string): string[] {
  return (
    q
      .normalize("NFC")
      .match(/[\p{L}\p{N}\p{M}]+/gu)
      ?.slice(0, MAX_QUERY_WORDS) ?? []
  );
}

/**
 * The parish directory's search predicate.
 *
 * Every word of the query must appear in the parish's name or in its place —
 * the derived `region` column, "Country/State/City", which every parish write
 * keeps in step with the payload — so "st mary chicago" finds St. Mary's in
 * Chicago. A word with a digit in it may also begin the
 * postal code, and the whole query may be a postal code as typed ("SW1A 1AA",
 * "60614-1234"). "Saint" and "St." are one word. Matching runs on columns of the
 * row, never on the payload except for the postal code, and the postal code is read
 * only for a query that has a digit in it. A word matches with or without its accents
 * (`accentBlindPattern`). That is a regular expression where an ILIKE used to be: over
 * 271,000 rows it takes as long as the ILIKE, within the noise of the measure (99 to 133
 * ms against 105 to 127 ms, each the best of eleven), and only nonsense costs more (under
 * a second for forty umlauts in a row). No index was helping, since the place column has
 * none and a word may match either column.
 */
function parishSearchSql(q: string): Prisma.Sql {
  const words = parishWords(q);
  const postal = Prisma.sql`(payload->>'postalCode')`;
  const wordMatches = words.map((word) => {
    const lower = word.toLowerCase();
    const pattern = accentBlindPattern(word);
    const name =
      lower === "saint" || lower === "st"
        ? // A whole "St" / "Saint", not every name containing the letters s-t.
          Prisma.sql`("title" ILIKE '%saint%' OR "title" ~* '(^|[^[:alpha:]])st([^[:alpha:]]|$)')`
        : Prisma.sql`"title" ~* ${pattern}`;
    const code = /\d/.test(word)
      ? Prisma.sql` OR ${postal} ILIKE ${`${escapeLike(word)}%`}`
      : Prisma.empty;
    return Prisma.sql`(${name} OR "region" ~* ${pattern}${code})`;
  });
  const allWords = wordMatches.length > 0 ? Prisma.join(wordMatches, " AND ") : Prisma.sql`FALSE`;
  if (!/\d/.test(q)) return Prisma.sql`(${allWords})`;
  return Prisma.sql`((${allWords}) OR ${postal} ILIKE ${`${escapeLike(q)}%`})`;
}

/**
 * One page of the parish directory, filtered by classification and/or a
 * search of names, places and postal codes (`parishSearchSql`). Thirty rows by
 * default: the page used to receive the entire table as client props, which at
 * the directory's target size is tens of megabytes per visitor.
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
  const pageSize = clampPageSize(opts.pageSize);
  const q = parseSearchQuery(opts.q);
  const classes =
    opts.class == null ? [] : Array.isArray(opts.class) ? [...opts.class] : [String(opts.class)];

  const filters: Prisma.Sql[] = [
    Prisma.sql`"contentType" = 'PARISH'::"ChecklistContentType"`,
    Prisma.sql`"isPublished"`,
  ];
  if (classes.length > 0) filters.push(Prisma.sql`"subtype" = ANY(${classes})`);
  if (q) filters.push(parishSearchSql(q));
  const where = Prisma.join(filters, " AND ");
  // A search lists the parishes whose NAME matches first, then those that
  // matched on their place or postal code; each group alphabetically.
  const nameMatch = parishWords(q).map(accentBlindPattern).join("[^[:alnum:]]+");
  // Many parishes share a name, so the id settles a tie: each page's query orders
  // ties its own way otherwise, and one parish shows on two pages and another on none.
  // The plain directory opens on names in the Latin alphabet, which most readers can
  // read, and every other script follows in its own order: by stored title alone it
  // opened on 36 Korean records, whose names the cards show romanized out of order.
  const order = nameMatch
    ? Prisma.sql`CASE WHEN "title" ~* ${nameMatch} THEN 0 ELSE 1 END, "title" ASC, "id" ASC`
    : Prisma.sql`CASE WHEN "title" ~ '^[A-Za-z]' THEN 0 ELSE 1 END, "title" ASC, "id" ASC`;

  return readUpToLastPage(clampPage(opts.page), async (page) => {
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT count(*)::bigint AS total FROM "PublishedContent" WHERE ${where}`,
      ),
      prisma.$queryRaw<ParishRow[]>(
        Prisma.sql`SELECT ${PARISH_COLUMNS} FROM "PublishedContent" WHERE ${where}
                   ORDER BY ${order}
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
  });
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
 *
 * `radiusMiles: null` asks for the nearest records at ANY distance. That is
 * the locator's last resort: the OSM sweep has only reached parts of the world
 * so far, so a visitor in a region the directory has not covered yet would
 * otherwise get a blank list, which reads as "there are no Catholic parishes
 * near you" — false, and the opposite of useful. Without a radius there is no
 * box to prefilter with, so this variant is only worth running once the
 * bounded attempts have come back empty.
 */
export async function listParishesNear(opts: {
  latitude: number;
  longitude: number;
  /** null = no limit; the nearest records wherever they are. */
  radiusMiles?: number | null;
  take?: number;
}): Promise<ParishListItem[]> {
  const { latitude, longitude } = opts;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return [];
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return [];
  const radiusMiles =
    opts.radiusMiles === null
      ? null
      : Math.min(Math.max(Number(opts.radiusMiles ?? 50) || 50, 1), 500);
  const take = Math.min(Math.max(Math.trunc(Number(opts.take ?? 50)) || 50, 1), 50);

  const filters: Prisma.Sql[] = [
    Prisma.sql`"contentType" = 'PARISH'::"ChecklistContentType"`,
    Prisma.sql`"isPublished"`,
  ];
  if (radiusMiles === null) {
    // No box to eliminate with, so exclude the un-geocoded rows explicitly —
    // their NULL distance would otherwise occupy the tail of the ORDER BY.
    filters.push(Prisma.sql`"latitude" IS NOT NULL AND "longitude" IS NOT NULL`);
  } else {
    const dLat = radiusMiles / MILES_PER_DEGREE_LAT;
    // Longitude degrees shrink toward the poles; the cosine is floored so the
    // box stays finite at high latitude rather than dividing by ~0.
    const cos = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
    const dLng = radiusMiles / (MILES_PER_DEGREE_LAT * cos);
    filters.push(Prisma.sql`"latitude" BETWEEN ${latitude - dLat} AND ${latitude + dLat}`);
    // Near a pole (or with a huge radius) the box spans every meridian, and
    // near the antimeridian it would wrap; in both cases drop the longitude
    // bound and let the distance ordering do the work.
    if (dLng < 180 && longitude - dLng >= -180 && longitude + dLng <= 180) {
      filters.push(Prisma.sql`"longitude" BETWEEN ${longitude - dLng} AND ${longitude + dLng}`);
    }
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
  // The bounding box is a square, so its corners exceed the radius; the
  // haversine result is the authority. An unlimited search keeps everything.
  return rows
    .filter((r) => radiusMiles === null || (r.distance_miles ?? 0) <= radiusMiles)
    .map(toParishItem);
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
  /** The content type of the group's best hit. */
  contentType: ChecklistContentType;
  label: string;
  /**
   * Every match under this label across all pages, where `items` holds only this
   * page's. Null when that is not known: the unindexed path does not count by
   * label, and its rows may run on to other pages.
   */
  total: number | null;
  items: SearchHit[];
}

export interface SearchResults {
  query: string;
  /** Total matches in the database, not the number returned. */
  total: number;
  hits: SearchHit[];
  /** The same hits grouped by type label, best group first. */
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
      // The probe must assert the WHOLE mechanism, not just the column. In the
      // state "column exists, trigger does not" every row's searchVector is
      // NULL, `@@` matches nothing, and search goes silently and totally dark
      // while still reporting indexed=true — worse than no column at all. That
      // state is reachable from a schema-only dump restore or a manual DROP
      // TRIGGER, and migration 0055 now creates the function/trigger inside a
      // guarded block that degrades rather than failing the deploy.
      const rows = await prisma.$queryRaw<Array<{ vector: boolean; trigram: boolean }>>(
        Prisma.sql`SELECT
          (EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name = 'PublishedContent'
                     AND column_name = 'searchVector')
           AND EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgrelid = to_regclass('public."PublishedContent"')
                         AND tgname = 'PublishedContent_searchVector_tgr'
                         AND NOT tgisinternal)) AS "vector",
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
    title: readerTitle(row),
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
  saints: SaintDuplicates,
  opts: { prefixLastTerm?: boolean } = {},
) {
  // Prefix-expanding the last term is what makes the header dropdown answer
  // while the visitor is still typing ("mar" → Mary). On the results page it
  // is the wrong trade: the expansion matches every lexeme sharing the stem,
  // which floats obscure near-spellings above the thing that was asked for.
  const tsq = toTsQueryText(query, opts.prefixLastTerm ?? false);
  const prefix = `${escapeLike(query.trim())}%`;
  const tsquery = Prisma.sql`to_tsquery('english', ${tsq})`;
  const trigramMatch = caps.trigram ? Prisma.sql`OR "title" % ${query.trim()}` : Prisma.empty;
  const rank = searchRank(query, tsquery, caps, saints);
  const where = Prisma.sql`"isPublished" AND (
    "searchVector" @@ ${tsquery}
    OR "title" ILIKE ${prefix}
    ${trigramMatch}
    OR ${isSaintAmong(saints.named)}
  ) AND NOT ${isSaintAmong(saints.hidden)}`;
  return { rank, where, hasTerms: tsq.length > 0 };
}

/**
 * The relevance of a row to `query`, given the tsquery it is matched with.
 * Shared by the site search and the per-type list search so the two order
 * their results the same way.
 */
function searchRank(
  query: string,
  tsquery: Prisma.Sql,
  caps: SearchCapabilities,
  saints: SaintDuplicates | null,
): Prisma.Sql {
  const prefix = `${escapeLike(query.trim())}%`;
  const similarity = caps.trigram
    ? Prisma.sql`+ similarity("title", ${query.trim()})`
    : Prisma.empty;
  // A title that contains the typed words as WHOLE words outranks one that
  // merely shares a prefix — without it "mary" ranked "Marie-Catherine
  // Troiani" above "Hail Mary", because the trailing `:*` expansion matches
  // many lexemes.
  const wholeWords = titleWordsPattern(query);
  const wordBoundary = wholeWords
    ? Prisma.sql`+ CASE WHEN "title" ~* ${wholeWords} THEN 2 ELSE 0 END`
    : Prisma.empty;
  // "Saint Nicodemus" answers "nicodemus" as exactly as a bare "Nicodemus" would: the
  // word before a saint's name is how the site names them, not what a reader types.
  const bareTitle = Prisma.sql`regexp_replace("title", '^(saints?|st\\.?)\\s+', '', 'i')`;
  // A saint the list names keeps the list's order among the matches, as the saint list's
  // own search does: "mary" is Our Lady before Mary Magdalene, "john" the Apostle before
  // John Bosco, "abraham" the Patriarch, and all of them before a namesake the list does
  // not name. Ten points a place outweighs everything else here put together. Only the
  // name counts, not what follows a comma: "Saint Elizabeth, Mother of John the Baptist"
  // is not a John.
  const named = wholeWords
    ? Prisma.sql`+ CASE WHEN "contentType" = 'SAINT'::"ChecklistContentType"
                         AND split_part("title", ',', 1) ~* ${wholeWords}
        THEN COALESCE(10000 - 10 * array_position(${SAINT_RANK_SLUGS}::text[], "slug"), 0)
        ELSE 0 END`
    : Prisma.empty;
  return Prisma.sql`(
    ts_rank_cd("searchVector", ${tsquery})
    + CASE WHEN lower("title") = lower(${query.trim()})
             OR lower(${bareTitle}) = lower(${query.trim()}) THEN 3 ELSE 0 END
    + CASE WHEN "title" ILIKE ${prefix} OR ${bareTitle} ILIKE ${prefix} THEN 1 ELSE 0 END
    ${wordBoundary}
    ${named}
    ${similarity}
    ${saints ? Prisma.sql`+ CASE WHEN ${isSaintAmong(saints.exactlyNamed)} THEN 3 ELSE 0 END` : Prisma.empty}
  )`;
}

/**
 * A query with no letters or digits names nothing. "%" and "_" must not reach the
 * patterns below as what they mean there, which is everything.
 */
function hasSearchableWords(query: string): boolean {
  return /[\p{L}\p{N}]/u.test(query);
}

/** The row is a saint, one of these, in the fallback's terms. */
function saintAmongWhere(slugs: readonly string[]): Prisma.PublishedContentWhereInput {
  return { contentType: "SAINT", slug: { in: [...slugs] } };
}

/** The original unindexed predicate, kept as the fallback path. */
function fallbackWhere(query: string, saints: SaintDuplicates): Prisma.PublishedContentWhereInput {
  // Prisma passes `contains` to LIKE as it stands, so what was typed is made literal.
  const literal = escapeLike(query);
  return {
    isPublished: true,
    NOT: saintAmongWhere(saints.hidden),
    OR: [
      { title: { contains: literal, mode: "insensitive" } },
      { slug: { contains: literal.toLowerCase(), mode: "insensitive" } },
      ...(saints.named.length > 0 ? [saintAmongWhere(saints.named)] : []),
    ],
  };
}

async function searchFallback(
  query: string,
  saints: SaintDuplicates,
  limit: number,
  offset: number,
): Promise<SearchRow[]> {
  const rows = await prisma.publishedContent.findMany({
    where: fallbackWhere(query, saints),
    select: { ...LIST_SELECT },
    // The id settles a tie, so an offset never repeats a row or skips one.
    orderBy: [{ title: "asc" }, { id: "asc" }],
    skip: offset,
    take: limit,
  });
  return rows;
}

/**
 * A page of search results, ranked, with the true total and a grouping by
 * type label. The results page used to report `hits.length` (capped at 50)
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
  if (!hasSearchableWords(q)) return empty;

  const [caps, saints] = await Promise.all([searchCapabilities(), saintDuplicatesFor(q)]);
  let rows: SearchRow[] = [];
  let total = 0;
  let indexed = false;
  const totalsByLabel = new Map<string, number>();

  if (caps.vector) {
    try {
      const { rank, where } = searchSql(q, caps, saints);
      // The id settles a tie on rank and title (two parishes of one name). Each page's
      // query orders ties its own way otherwise, so one row shows on two pages and
      // another on none, while the counts still add up.
      const [countRows, hitRows] = await Promise.all([
        prisma.$queryRaw<
          Array<{ contentType: ChecklistContentType; subtype: string | null; total: bigint }>
        >(
          Prisma.sql`SELECT "contentType", "subtype", count(*)::bigint AS total
                     FROM "PublishedContent"
                     WHERE ${where}
                     GROUP BY "contentType", "subtype"`,
        ),
        // The site's own pages lead, and the churches named after them follow: "fatima"
        // opens on the apparition and its prayer, not on 24 parishes called Fatima. The
        // parish directory has 270,000 names to the site's 6,000 pages, so by rank alone
        // they filled the first page of every devotion's search.
        prisma.$queryRaw<SearchRow[]>(
          Prisma.sql`SELECT ${SEARCH_COLUMNS}, ${rank} AS "rank"
                     FROM "PublishedContent"
                     WHERE ${where}
                     ORDER BY CASE WHEN "contentType" = 'PARISH'::"ChecklistContentType" THEN 1 ELSE 0 END,
                              "rank" DESC, "title" ASC, "id" ASC
                     LIMIT ${pageSize} OFFSET ${offset}`,
        ),
      ]);
      for (const row of countRows) {
        const count = Number(row.total);
        const label = contentTypeLabel(row.contentType, row.subtype);
        total += count;
        totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + count);
      }
      rows = hitRows;
      indexed = true;
    } catch {
      // A malformed tsquery or a half-applied migration must not break search.
      indexed = false;
    }
  }

  if (!indexed) {
    rows = await searchFallback(q, saints, pageSize, offset);
    total = await prisma.publishedContent
      .count({ where: fallbackWhere(q, saints) })
      .catch(() => rows.length);
  }

  // A pasted slug that matched nothing as words is still worth one exact
  // lookup — cheap, and it keeps "our-father" working as a query.
  if (rows.length === 0 && /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(q.toLowerCase())) {
    const exact = await prisma.publishedContent.findFirst({
      where: { slug: q.toLowerCase(), isPublished: true, NOT: saintAmongWhere(saints.hidden) },
      select: { ...LIST_SELECT },
    });
    if (exact) {
      rows = [exact];
      total = 1;
    }
  }

  const hits = rows.map(toSearchHit);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Grouped by what each hit is called, so a heading is true of every row under
  // it: a Litany stands apart from the Prayers, as the header's suggestions show.
  const grouped = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const arr = grouped.get(hit.typeLabel) ?? [];
    arr.push(hit);
    grouped.set(hit.typeLabel, arr);
  }
  const groups: SearchResultGroup[] = [...grouped.entries()].map(([label, items]) => ({
    contentType: items[0].contentType,
    label,
    total: totalsByLabel.get(label) ?? (pageCount === 1 ? items.length : null),
    items,
  }));

  return {
    query: q,
    total,
    hits,
    groups,
    page,
    pageSize,
    pageCount,
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
  if (q.length < 2 || !hasSearchableWords(q)) return [];
  const limit = Math.min(Math.max(Math.trunc(Number(perGroup)) || 3, 1), 10);
  const [caps, saints] = await Promise.all([searchCapabilities(), saintDuplicatesFor(q)]);

  let rows: SearchRow[] = [];
  // Tracked explicitly rather than inferred from `rows.length === 0`, which
  // cannot tell "the indexed query threw" from "this query genuinely matches
  // nothing". Every no-match keystroke in the header autocomplete — the great
  // majority of them, mid-word — used to pay for the indexed LATERAL query AND
  // an unindexed 200-row `contains` scan of the whole published table.
  let indexed = false;
  if (caps.vector) {
    try {
      const { rank, where } = searchSql(q, caps, saints, { prefixLastTerm: true });
      rows = await prisma.$queryRaw<SearchRow[]>(
        Prisma.sql`
          SELECT s.* FROM unnest(${ALL_CONTENT_TYPES}::text[]) AS t(ct)
          CROSS JOIN LATERAL (
            SELECT ${SEARCH_COLUMNS}, ${rank} AS "rank"
            FROM "PublishedContent"
            WHERE "contentType" = t.ct::"ChecklistContentType" AND ${where}
            ORDER BY "rank" DESC, "title" ASC, "id" ASC
            LIMIT ${limit}
          ) s
          ORDER BY s."rank" DESC, s."title" ASC, s."id" ASC`,
      );
      indexed = true;
    } catch {
      rows = [];
      indexed = false;
    }
  }
  if (!indexed) {
    // Fallback: the original predicate, but capped per group in JS so small
    // groups still surface.
    const fallback = await searchFallback(q, saints, 200, 0);
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
    label: readerTitle(row),
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
