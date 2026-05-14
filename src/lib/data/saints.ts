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

/**
 * Build a Prisma `where` clause that returns the right slice for each
 * Saints-page filter. Filtering is done in two phases:
 *
 *   1. Pull a broad PUBLISHED slice from Postgres with a quick
 *      case-insensitive `contains` match on canonicalName. (Postgres
 *      cannot run our richer name regex against arbitrary text in a
 *      portable way, so we keep this layer coarse.)
 *   2. Re-filter in JS with `categorizeSaintByName` so a row with an
 *      ambiguous Postgres match (e.g. "Saint Michael the Martyr") is
 *      kicked out of the angel filter.
 *
 * The default "saint" view excludes anything categorised as Our Lady
 * or as an Angel so those entries do not double-up under the Saints
 * tab.
 */
function buildCategoryWhere(category: SaintCategory | undefined): {
  status: "PUBLISHED";
  AND?: object[];
} {
  if (!category || category === "saint") {
    return { status: "PUBLISHED" };
  }
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
            { canonicalName: { contains: "Mary, Mother", mode: "insensitive" } },
          ],
        },
      ],
    };
  }
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

/**
 * Canonical "most venerable first" ordering applied to the Saints list
 * before falling back to alphabetical:
 *
 *   1. Our Lady (Blessed Virgin Mary)
 *   2. Saint Joseph
 *   3. The Twelve Apostles, in the traditional Western order
 *   4. Other patriarchs and great evangelists by historical proximity
 *      to Christ (Mary Magdalene, Stephen, Paul)
 *
 * The remaining saints fall through to alphabetical by canonicalName.
 * The ordering is intentionally pastoral, not dogmatic: it surfaces
 * the figures most users want at the top of the catalog.
 */
const VENERATION_ORDER: ReadonlyArray<RegExp> = [
  /\b(our\s+lady|blessed\s+virgin|virgin\s+mary|theotokos|madonna|notre\s+dame|nuestra\s+señora)\b/i,
  /\bsaint\s+joseph\b/i,
  // Twelve Apostles in the traditional order: Peter, Andrew, James the
  // Greater, John, Philip, Bartholomew, Thomas, Matthew, James the Less,
  // Jude (Thaddaeus), Simon the Zealot, Matthias (in place of Judas).
  /\b(saint\s+)?peter(\s+the\s+apostle)?\b/i,
  /\b(saint\s+)?andrew(\s+the\s+apostle)?\b/i,
  /\b(saint\s+)?james\s+the\s+greater\b/i,
  /\b(saint\s+)?john\s+the\s+(apostle|evangelist|beloved)\b/i,
  /\b(saint\s+)?philip(\s+the\s+apostle)?\b/i,
  /\b(saint\s+)?bartholomew\b/i,
  /\b(saint\s+)?thomas(\s+the\s+apostle)?\b/i,
  /\b(saint\s+)?matthew(\s+the\s+(apostle|evangelist))?\b/i,
  /\b(saint\s+)?james\s+(the\s+)?less(er)?\b/i,
  /\b(saint\s+)?jude(\s+thaddaeus|\s+the\s+apostle)?\b/i,
  /\b(saint\s+)?simon\s+(the\s+)?zealot\b/i,
  /\b(saint\s+)?matthias\b/i,
  // Two great evangelists / first martyrs immediately after the Twelve.
  /\b(saint\s+)?mary\s+magdalen(e|a)\b/i,
  /\b(saint\s+)?stephen(\s+the\s+protomartyr)?\b/i,
  // Match "Saint Paul" / "Paul the Apostle" but NOT "John Paul II" —
  // the negative lookbehind keeps pope-John-Paul rows out of the
  // apostolic ranking.
  /(?<!john\s)\b(saint\s+)?paul(\s+the\s+apostle)?\b/i,
];

/** Returns the veneration-rank for a saint (lower number = higher rank). */
export function venerationRank(canonicalName: string): number {
  for (let i = 0; i < VENERATION_ORDER.length; i++) {
    if (VENERATION_ORDER[i].test(canonicalName)) return i;
  }
  return VENERATION_ORDER.length;
}

function sortByVeneration<T extends { canonicalName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = venerationRank(a.canonicalName);
    const rb = venerationRank(b.canonicalName);
    if (ra !== rb) return ra - rb;
    return a.canonicalName.localeCompare(b.canonicalName);
  });
}

export async function listPublishedSaintsPaginated(
  locale: Locale,
  page = 1,
  pageSize = PAGE_SIZE,
  category?: SaintCategory,
) {
  const skip = (page - 1) * pageSize;
  const where = buildCategoryWhere(category);
  // Fetch a broad slice and sort in JS by the canonical veneration order
  // so Mary, Joseph, the Twelve Apostles, and the great evangelists land
  // at the top — then page in-memory.
  const broad = await prisma.saint.findMany({
    where,
    include: { translations: { where: { locale } } },
    orderBy: { canonicalName: "asc" },
  });
  // The default "Saints" tab is the place for canonised saints. Anyone
  // who properly belongs under Our Lady or Angels is filtered out here
  // so the same row never appears in two tabs.
  const filtered =
    !category || category === "saint"
      ? broad.filter((s) => categorizeSaintByName(s.canonicalName) === "saint")
      : broad.filter((s) => categorizeSaintByName(s.canonicalName) === category);
  const ordered = sortByVeneration(filtered);
  const total = ordered.length;
  const items = ordered.slice(skip, skip + pageSize);
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Return `true` when a stored `feastDay` string matches the given
 * year-month-day in the user's current timezone. Feast-day strings are
 * stored freeform (e.g. "August 28", "Aug 28", "28 August", "August
 * 28 — Doctor of the Church") so the matcher is generous about case,
 * separators, and trailing prose. Multi-feast strings ("August 4 / 5
 * (1969 reform)") are split on commas, slashes, and semicolons and
 * matched component-wise.
 */
export function feastDayMatchesDate(
  feastDay: string | null | undefined,
  month: number,
  day: number,
): boolean {
  if (!feastDay) return false;
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) return false;
  const monthAbbrev = monthName.slice(0, 3);
  // Multi-feast strings ("August 4 / 5 (1969 reform)") are tricky:
  // the second component does not repeat the month name. We split on
  // commas / slashes / semicolons, then walk the parts left-to-right;
  // a part without an explicit month inherits the most recent month
  // we saw.
  const parts = feastDay.split(/[,/;]/);
  const dayPattern = new RegExp(`\\b${day}(st|nd|rd|th)?\\b`, "i");
  let currentMonthMatchesQuery = false;
  let anyMonthSeen = false;
  for (const part of parts) {
    const lower = part.toLowerCase();
    const partHasAnyMonth = MONTH_NAMES.some((n) => {
      const lcn = n.toLowerCase();
      return lower.includes(lcn) || lower.includes(lcn.slice(0, 3));
    });
    if (partHasAnyMonth) {
      anyMonthSeen = true;
      currentMonthMatchesQuery =
        lower.includes(monthName.toLowerCase()) ||
        lower.includes(monthAbbrev.toLowerCase());
    }
    // If we have not seen any month yet, this part cannot match.
    if (!anyMonthSeen) continue;
    if (currentMonthMatchesQuery && dayPattern.test(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * Saints whose feast day falls on the given calendar date. Used by the
 * homepage "Today's Feast Day Saints" panel and by /saints/today.
 *
 * Implementation note: feast-day strings are not stored in a
 * structured form (month + day columns), so we cannot push the date
 * match into SQL. We fetch every PUBLISHED saint that mentions the
 * month name and re-filter in JS for the precise day. The catalog is
 * small enough that this is fine; if the catalog grows past a few
 * thousand rows we can split feastDay into structured columns.
 */
export async function listSaintsForFeastDate(
  locale: Locale,
  month: number,
  day: number,
) {
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) return [];
  const monthAbbrev = monthName.slice(0, 3);
  const candidates = await prisma.saint.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { feastDay: { contains: monthName, mode: "insensitive" } },
        { feastDay: { contains: monthAbbrev, mode: "insensitive" } },
      ],
    },
    include: { translations: { where: { locale } } },
    orderBy: { canonicalName: "asc" },
  });
  const matches = candidates.filter((s) => feastDayMatchesDate(s.feastDay, month, day));
  return sortByVeneration(matches);
}
