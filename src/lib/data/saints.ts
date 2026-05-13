import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

const PAGE_SIZE = 9;

export function listPublishedSaints(locale: Locale, take = 60) {
  return prisma.saint.findMany({
    where: { status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
    orderBy: { canonicalName: "asc" },
    take,
  });
}

export type SaintCategory = "saint" | "our-lady" | "angel";

/**
 * Canonical-name patterns that distinguish Our Lady / Marian saints
 * (Blessed Virgin Mary titles) and the named angels (Michael, Gabriel,
 * Raphael, plus their feasts) from the bulk of canonized saints. The
 * patterns are intentionally generous so a "Saint Gabriel the Archangel"
 * row written either way lands in the angels category.
 */
const OUR_LADY_PATTERN =
  /\b(our\s+lady|blessed\s+virgin|virgin\s+mary|maria\s+mater|stella\s+maris|theotokos|nuestra\s+señora|notre\s+dame|madonna)\b/i;

const ANGEL_PATTERN =
  /\b(archangels?|angels?|michael(?!\s+the\s+martyr)|gabriel|raphael|guardian\s+angels?|seraphim|cherubim)\b/i;

function buildCategoryWhere(category: SaintCategory | undefined): {
  status: "PUBLISHED";
  AND?: object[];
} {
  if (!category || category === "saint") {
    return { status: "PUBLISHED" };
  }
  // Postgres regex match (case-insensitive). Prisma exposes `mode: insensitive`
  // for `contains`; that's enough for our coarse filter.
  if (category === "our-lady") {
    return {
      status: "PUBLISHED",
      AND: [
        {
          OR: [
            { canonicalName: { contains: "Our Lady", mode: "insensitive" } },
            { canonicalName: { contains: "Blessed Virgin", mode: "insensitive" } },
            { canonicalName: { contains: "Virgin Mary", mode: "insensitive" } },
            { canonicalName: { contains: "Madonna", mode: "insensitive" } },
            { canonicalName: { contains: "Notre Dame", mode: "insensitive" } },
            { canonicalName: { contains: "Theotokos", mode: "insensitive" } },
            { canonicalName: { contains: "Nuestra Señora", mode: "insensitive" } },
          ],
        },
      ],
    };
  }
  // angels
  return {
    status: "PUBLISHED",
    AND: [
      {
        OR: [
          { canonicalName: { contains: "Archangel", mode: "insensitive" } },
          { canonicalName: { contains: "Angel", mode: "insensitive" } },
          { canonicalName: { contains: "Michael", mode: "insensitive" } },
          { canonicalName: { contains: "Gabriel", mode: "insensitive" } },
          { canonicalName: { contains: "Raphael", mode: "insensitive" } },
          { canonicalName: { contains: "Seraphim", mode: "insensitive" } },
          { canonicalName: { contains: "Cherubim", mode: "insensitive" } },
        ],
      },
    ],
  };
}

/** Apply the same coarse filter in JS so a server-side helper can mirror it. */
export function categorizeSaintByName(canonicalName: string): SaintCategory {
  if (OUR_LADY_PATTERN.test(canonicalName)) return "our-lady";
  if (ANGEL_PATTERN.test(canonicalName)) return "angel";
  return "saint";
}

export async function listPublishedSaintsPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
  category?: SaintCategory,
) {
  const skip = (page - 1) * pageSize;
  const where = buildCategoryWhere(category);
  const [items, total] = await Promise.all([
    prisma.saint.findMany({
      where,
      include: { translations: { where: { locale } } },
      orderBy: { canonicalName: "asc" },
      take: pageSize,
      skip,
    }),
    prisma.saint.count({ where }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function listAdminSaints(take = 200) {
  return prisma.saint.findMany({
    orderBy: { canonicalName: "asc" },
    take,
  });
}

export function searchSaints(q: string, take = 10) {
  return prisma.saint.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { canonicalName: { contains: q, mode: "insensitive" } },
        { biography: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function listSavedSaintsForUser(userId: string) {
  return prisma.userSavedSaint.findMany({
    where: { userId },
    include: { saint: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getPublishedSaintBySlug(slug: string, locale: Locale) {
  return prisma.saint.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { translations: { where: { locale } } },
  });
}
