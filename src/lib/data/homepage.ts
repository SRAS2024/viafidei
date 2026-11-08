import { Prisma, type ChecklistContentType } from "@prisma/client";

import { MEMO_TTL, memo } from "../cache/memo";
import { formatEnumValue } from "../content-shared/field-presenters";
import { DISPLAY_ORDER_LISTS } from "../content-shared/display-order";
import { categorizePrayer, prayerCategoryLabel } from "../content-shared/prayer-categories";
import {
  SAINT_DISPLAY_ORDER,
  saintCardDetails,
  type SaintCardDetails,
} from "../content-shared/saints";
import { prisma } from "../db/client";
import { displayItem } from "../translation/display";
import { localizeItems } from "../translation/localize";

export const HOMEPAGE_SLUG = "homepage";

const DEFAULT_BLOCKS = [
  {
    blockKey: "hero",
    blockType: "hero",
    sortOrder: 0,
    configJson: {
      eyebrow: "Est. MMXXVI · Canonical",
      title: "A quiet place to pray, to learn, and to return.",
      lede: "Via Fidei is a Catholic companion — a curated library of prayers, saints, sacramental guidance, liturgical formation, and parish discovery.",
    },
  },
  {
    blockKey: "mission",
    blockType: "two-column",
    sortOrder: 1,
    configJson: {
      left: {
        title: "Our mission",
        body: "We make the beauty and precision of the Catholic tradition legible.",
      },
      right: {
        title: "What is Catholicism?",
        body: "The Catholic Church is the community of disciples gathered around Jesus Christ.",
      },
    },
  },
];

export async function getOrCreateHomepage() {
  const existing = await prisma.homePage.findUnique({
    where: { slug: HOMEPAGE_SLUG },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  return prisma.homePage.create({
    data: {
      slug: HOMEPAGE_SLUG,
      title: "Via Fidei",
      status: "DRAFT",
      blocks: { create: DEFAULT_BLOCKS },
    },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
}

export type HomepageBlockUpdate = {
  id: string;
  blockKey: string;
  blockType: string;
  sortOrder: number;
  configJson: Record<string, unknown>;
};

export async function getHomepageWithBlocks(pageId: string) {
  return prisma.homePage.findUnique({
    where: { id: pageId },
    include: { blocks: true },
  });
}

export function persistHomepageBlocks(pageId: string, blocks: HomepageBlockUpdate[]) {
  return prisma.$transaction([
    ...blocks.map((b) =>
      prisma.homePageBlock.update({
        where: { id: b.id },
        data: {
          configJson: b.configJson as never,
          sortOrder: b.sortOrder,
          blockType: b.blockType,
          blockKey: b.blockKey,
        },
      }),
    ),
    prisma.homePage.update({
      where: { id: pageId },
      data: { version: { increment: 1 }, status: "PUBLISHED" },
    }),
  ]);
}

/* ------------------------------------------------------------------ *
 * Worker-managed "featured" rails.
 *
 * The "Request Homepage Makeover" flow proposes featured-* blocks
 * (heading + a short list of published items). When such a draft is
 * published, those blocks land on the HomePage record and the live
 * homepage renders them in place of the static featured prayers rail.
 * If none are present (the common case), the homepage falls back to its
 * static sections — so there is zero visual change until a makeover is
 * explicitly published.
 * ------------------------------------------------------------------ */

/** Each featured block type: the content it features and where those pages live. */
const FEATURED_SOURCES: Readonly<
  Record<string, { contentType: ChecklistContentType; prefix: string }>
> = {
  "featured-prayers": { contentType: "PRAYER", prefix: "/prayers" },
  "featured-saints": { contentType: "SAINT", prefix: "/saints" },
  "featured-devotions": { contentType: "DEVOTION", prefix: "/devotions" },
  "featured-novenas": { contentType: "NOVENA", prefix: "/novenas" },
  "featured-sacraments": { contentType: "SACRAMENT", prefix: "/sacraments" },
  "featured-apparitions": { contentType: "APPARITION", prefix: "/our-lady" },
};

export function featuredHrefFor(blockType: string, slug: string): string {
  const prefix = FEATURED_SOURCES[blockType]?.prefix ?? "/prayers";
  return `${prefix}/${encodeURIComponent(slug)}`;
}

export type FeaturedItem = {
  slug: string;
  title: string;
  /** Short lines under the title: a prayer's type, a devotion's or novena's subtitle. */
  meta?: string[];
  /** A saint's patronage and feast day, worded by the page in the reader's language. */
  saint?: SaintCardDetails;
};
export type FeaturedBlockView = {
  blockKey: string;
  blockType: string;
  heading: string;
  items: FeaturedItem[];
};

function humanLabelFromKey(blockKey: string): string {
  return blockKey
    .replace(/^featured-/, "Featured ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse a stored featured block's configJson into a typed view. */
export function parseFeaturedBlock(block: {
  blockKey: string;
  blockType: string;
  configJson: unknown;
}): FeaturedBlockView {
  const cfg =
    block.configJson && typeof block.configJson === "object"
      ? (block.configJson as Record<string, unknown>)
      : {};
  const heading = typeof cfg.heading === "string" ? cfg.heading : humanLabelFromKey(block.blockKey);
  const rawItems = Array.isArray(cfg.items) ? cfg.items : [];
  const items: FeaturedItem[] = rawItems
    .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : {}))
    .filter((it) => typeof it.slug === "string" && it.slug.trim() !== "")
    .map((it) => {
      const slug = it.slug as string;
      return { slug, title: typeof it.title === "string" ? it.title : slug };
    });
  return { blockKey: block.blockKey, blockType: block.blockType, heading, items };
}

/** The columns of a featured item's row that its card reads, payloads projected away. */
type FeaturedRow = {
  contentType: ChecklistContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  subtype: string | null;
  category: string | null;
  intentionTheme: string | null;
  patronages: unknown;
  patronage: string | null;
  feastDay: string | null;
  feastMonth: number | null;
  feastDayOfMonth: number | null;
};

const rowKey = (contentType: string, slug: string) => `${contentType}:${slug}`;

/**
 * The published rows behind every featured item, in ONE query that pulls only
 * the JSON fields a card shows: a novena's payload holds nine days of prayers,
 * and the homepage is the site's most visited page.
 */
async function loadFeaturedRows(blocks: readonly FeaturedBlockView[]): Promise<FeaturedRow[]> {
  const pairs = blocks.flatMap((block) => {
    const source = FEATURED_SOURCES[block.blockType];
    return source ? block.items.map((item) => ({ ...source, slug: item.slug })) : [];
  });
  if (pairs.length === 0) return [];
  const wanted = Prisma.join(
    pairs.map((p) => Prisma.sql`(${p.contentType}::text::"ChecklistContentType", ${p.slug})`),
  );
  return prisma.$queryRaw<FeaturedRow[]>(
    Prisma.sql`SELECT "contentType", "slug", "title", "subtitle", "subtype",
                      payload->>'category'       AS "category",
                      payload->>'intentionTheme' AS "intentionTheme",
                      payload->'patronages'      AS "patronages",
                      payload->>'patronage'      AS "patronage",
                      payload->>'feastDay'       AS "feastDay",
                      "feastMonth", "feastDayOfMonth"
                 FROM "PublishedContent"
                WHERE "isPublished"
                  AND ("contentType", "slug") IN (${wanted})`,
  );
}

/**
 * Stored subtitles that only say what the rail's heading already says. The
 * worker falls back to them when it has nothing more particular to say, and on
 * three cards at once they are noise.
 */
const GENERIC_SUBTITLE =
  /^(?:a devotion of the catholic faithful|catholic devotion|a nine-day catholic devotion)$/i;

/** A subtitle's particular part: "Catholic devotion · 10 min" says "10 min". */
function particularSubtitle(subtitle: string | null): string | null {
  const parts = (subtitle ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter((part) => part && !GENERIC_SUBTITLE.test(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "the intercession of Mary Immaculate" as the line of a card: "The intercession…". */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The short lines a featured item's card shows under its title. */
function featuredDetails(row: FeaturedRow): Pick<FeaturedItem, "meta" | "saint"> {
  switch (row.contentType) {
    case "PRAYER": {
      const category = categorizePrayer({
        title: row.title,
        prayerType: row.subtype,
        category: row.category,
      });
      // "General" names no type, so a general prayer's card is its title alone.
      return { meta: category === "general" ? [] : [prayerCategoryLabel(category)] };
    }
    case "SAINT":
      return { meta: [], saint: saintCardDetails(row) };
    case "NOVENA": {
      // A novena's subtitle is mostly its calendar ("begins 12 November, ending
      // on…"); what it is prayed for says more in one line. Older rows store the
      // intention as an enum, so it is humanised the way the novena list does.
      const theme = row.intentionTheme?.trim();
      return { meta: theme ? [sentenceCase(formatEnumValue("intentionTheme", theme))] : [] };
    }
    default: {
      // Where the subtitle has nothing particular to say, the indexed type does
      // ("Marian"), as on the devotions page; "General" names no type.
      const type = row.subtype?.trim();
      const line =
        particularSubtitle(row.subtitle) ??
        (type && type !== "general" ? formatEnumValue("devotionType", type) : null);
      return { meta: line ? [line] : [] };
    }
  }
}

/**
 * The stored blocks with each item read from its own page's row: the blocks keep
 * a copy of the title from when they were drafted (on production, raw identifiers
 * such as "saint-joseph-volotsky"), and an item whose page has since gone is
 * dropped rather than linked to a 404. A block type with no known pages cannot
 * link anywhere, so it is dropped too, as is a rail left empty.
 */
function resolveFeaturedBlocks(
  blocks: readonly FeaturedBlockView[],
  rows: readonly FeaturedRow[],
  { keepEmpty = false }: { keepEmpty?: boolean } = {},
): FeaturedBlockView[] {
  const bySlug = new Map(rows.map((row) => [rowKey(row.contentType, row.slug), row]));
  return blocks
    .map((block) => {
      const source = FEATURED_SOURCES[block.blockType];
      if (!source) return { ...block, items: [] };
      const seen = new Set<string>();
      const items: FeaturedItem[] = [];
      for (const item of block.items) {
        const row = bySlug.get(rowKey(source.contentType, item.slug));
        if (!row || seen.has(item.slug)) continue;
        seen.add(item.slug);
        items.push({ slug: item.slug, title: row.title, ...featuredDetails(row) });
      }
      return { ...block, items };
    })
    .filter((block) => keepEmpty || block.items.length > 0);
}

/** Where a rail that has lost a card finds another: the head of its type's own list. */
const RAIL_REPLACEMENTS: Readonly<Record<string, readonly string[]>> = {
  "featured-prayers": DISPLAY_ORDER_LISTS.prayers,
  "featured-saints": SAINT_DISPLAY_ORDER,
};

/** The rails whose lists have no fixed order: their pages list them by title. */
const RAIL_REPLACEMENTS_BY_TITLE: Readonly<Record<string, ChecklistContentType>> = {
  "featured-devotions": "DEVOTION",
  "featured-novenas": "NOVENA",
};

/** The head of a rail's own list, leaving out what is already on it. */
async function replacementsFor(
  blockType: string,
  onRail: ReadonlySet<string>,
  howMany: number,
): Promise<readonly string[]> {
  const list = RAIL_REPLACEMENTS[blockType];
  if (list) return list.filter((slug) => !onRail.has(slug)).slice(0, howMany);
  const contentType = RAIL_REPLACEMENTS_BY_TITLE[blockType];
  if (!contentType) return [];
  const rows = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true, slug: { notIn: [...onRail] } },
    orderBy: { title: "asc" },
    take: howMany,
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/**
 * A rail keeps the number of cards it was drafted with. When the page behind one
 * has gone, the worker may not be running to redraft the rail, so the best known
 * prayers and saints not already on it fill the place.
 */
async function makeUpFeaturedRails(
  drafted: readonly FeaturedBlockView[],
  resolved: FeaturedBlockView[],
): Promise<FeaturedBlockView[]> {
  const count = (block: FeaturedBlockView) => new Set(block.items.map((item) => item.slug)).size;
  const candidates = (
    await Promise.all(
      resolved.map(async (block) => {
        const wanted = drafted.find((d) => d.blockKey === block.blockKey);
        if (!wanted || count(block) >= count(wanted)) return null;
        const onRail = new Set(block.items.map((item) => item.slug));
        // More than the places to fill, in case some of these have gone too.
        const items = await replacementsFor(block.blockType, onRail, count(wanted) + 8);
        return items.length > 0
          ? { ...block, items: items.map((slug) => ({ slug, title: slug })) }
          : null;
      }),
    )
  ).filter((block): block is FeaturedBlockView => block !== null);
  if (candidates.length === 0) return resolved;

  const found = resolveFeaturedBlocks(candidates, await loadFeaturedRows(candidates));
  return resolved.map((block) => {
    const wanted = drafted.find((d) => d.blockKey === block.blockKey);
    const extra = found.find((f) => f.blockKey === block.blockKey);
    if (!wanted || !extra) return block;
    const places = count(wanted) - count(block);
    return { ...block, items: [...block.items, ...extra.items.slice(0, places)] };
  });
}

/** Show each resolved title in the reader's language, as the list pages do. */
async function localizeFeaturedTitles(blocks: FeaturedBlockView[]): Promise<FeaturedBlockView[]> {
  const entries = blocks.flatMap((block) =>
    block.items.map((item) => ({
      contentType: FEATURED_SOURCES[block.blockType]!.contentType,
      slug: item.slug,
      title: item.title,
    })),
  );
  const shown = await localizeItems(entries, { depth: "card" });
  const titles = new Map(
    shown.map((entry) => [rowKey(entry.contentType, entry.slug), displayItem(entry).title]),
  );
  return blocks.map((block) => ({
    ...block,
    items: block.items.map((item) => ({
      ...item,
      title:
        titles.get(rowKey(FEATURED_SOURCES[block.blockType]!.contentType, item.slug)) ?? item.title,
    })),
  }));
}

/** Featured rails to render on the live homepage. Only returns blocks
 *  once a makeover has been published (HomePage.status PUBLISHED) and
 *  only those that actually have items, so empty rails never show. */
export async function getPublishedFeaturedBlocks(): Promise<FeaturedBlockView[]> {
  // Memoised on the list tier like every other shared list on the site. The
  // memo holds the stored English; the reader's language is applied per request.
  const blocks = await memo("homepage:featured-blocks", MEMO_TTL.list, async () => {
    const page = await prisma.homePage.findUnique({
      where: { slug: HOMEPAGE_SLUG },
      include: {
        blocks: {
          where: { blockType: { startsWith: "featured-" } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!page || page.status !== "PUBLISHED") return [];
    const parsed = page.blocks.map(parseFeaturedBlock).filter((b) => b.items.length > 0);
    // A rail whose stored cards have all gone is kept until it has been made up, and
    // only a rail still empty after that is left out.
    const made = await makeUpFeaturedRails(
      parsed,
      resolveFeaturedBlocks(parsed, await loadFeaturedRows(parsed), { keepEmpty: true }),
    );
    return made.filter((block) => block.items.length > 0);
  });
  return localizeFeaturedTitles(blocks);
}
