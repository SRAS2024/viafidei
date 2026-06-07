import { prisma } from "../db/client";

export const HOMEPAGE_SLUG = "homepage";

const DEFAULT_BLOCKS = [
  {
    blockKey: "hero",
    blockType: "hero",
    sortOrder: 0,
    configJson: {
      eyebrow: "Est. MMXXVI · Canonical",
      title: "A quiet place to pray, to learn, and to return.",
      lede: "Via Fidei is a multilingual Catholic companion — a curated library of prayers, saints, sacramental guidance, liturgical formation, and parish discovery.",
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

/** Maps a featured block type to its public content route prefix. */
const FEATURED_ROUTE_PREFIX: Record<string, string> = {
  "featured-prayers": "/prayers",
  "featured-saints": "/saints",
  "featured-devotions": "/devotions",
  "featured-novenas": "/novenas",
  "featured-sacraments": "/sacraments",
};

export function featuredHrefFor(blockType: string, slug: string): string {
  const prefix = FEATURED_ROUTE_PREFIX[blockType] ?? "/prayers";
  return `${prefix}/${encodeURIComponent(slug)}`;
}

export type FeaturedItem = { slug: string; title: string };
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
    .filter((it) => typeof it.slug === "string" && typeof it.title === "string")
    .map((it) => ({ slug: it.slug as string, title: it.title as string }));
  return { blockKey: block.blockKey, blockType: block.blockType, heading, items };
}

/** Featured rails to render on the live homepage. Only returns blocks
 *  once a makeover has been published (HomePage.status PUBLISHED) and
 *  only those that actually have items, so empty rails never show. */
export async function getPublishedFeaturedBlocks(): Promise<FeaturedBlockView[]> {
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
  return page.blocks.map(parseFeaturedBlock).filter((b) => b.items.length > 0);
}
