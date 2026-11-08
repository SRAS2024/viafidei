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
