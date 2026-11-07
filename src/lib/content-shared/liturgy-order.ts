/**
 * How /liturgy arranges its entries: the Mass and the rites first, then the
 * seasons, the feasts and the memorials each as the year brings them, then the
 * entries that explain. Pure, so the page and a test read the same answer.
 * Nothing on the page describes this order: it simply reads the way the Church
 * keeps her year, which an alphabet of "Feast of…" and "Solemnity of…" does not.
 */
import { LITURGICAL_FILTERS } from "./liturgical-categories";
import type { PayloadFilter } from "./payload-filter";

/** Anything the order needs from an entry. */
export interface LiturgyEntry {
  slug: string;
  title: string;
  payload: Record<string, unknown>;
}

const SECTION_ORDER = ["mass-rites", "seasons", "feasts", "memorials", "explained"];

/** The page's sections in reading order: every filter except "All". */
export const LITURGY_SECTIONS: readonly PayloadFilter[] = LITURGICAL_FILTERS.filter(
  (filter) => filter.key !== "all",
).sort((a, b) => sectionRank(a.key) - sectionRank(b.key));

/** A filter added later and not placed above simply follows the others. */
function sectionRank(key: string): number {
  const rank = SECTION_ORDER.indexOf(key);
  return rank < 0 ? SECTION_ORDER.length : rank;
}

/** The entries that carry no date, in the order a reader meets them. */
const NAMED_ORDER: readonly string[] = [
  // The Mass, the prayer of the Church, then the rites as a life receives them.
  "structure-roman-rite-mass",
  "eucharistic-prayers-of-the-roman-missal",
  "lectionary-cycles-and-the-order-of-readings",
  "the-roman-missal-third-edition",
  "structure-of-the-liturgy-of-the-hours",
  "exposition-and-benediction-of-the-blessed-sacrament",
  "rite-of-baptism-for-children",
  "ocia-scrutinies-and-the-easter-vigil-sacraments",
  "rite-of-confirmation",
  "rite-of-marriage",
  "rites-of-ordination",
  "order-of-christian-funerals",
  // The year from Advent to Ordinary Time, each season before its great days.
  "the-liturgical-year",
  "season-advent",
  "gaudete-sunday",
  "season-christmas",
  "octave-of-christmas",
  "season-lent",
  "ash-wednesday",
  "laetare-sunday",
  "holy-week",
  "palm-sunday-of-the-passion-of-the-lord",
  "season-triduum",
  "holy-thursday-mass-of-the-lords-supper",
  "good-friday-of-the-lords-passion",
  "holy-saturday-and-the-easter-vigil",
  "season-easter",
  "octave-of-easter",
  "divine-mercy-sunday",
  "season-ordinary-time",
  // What the calendar's terms mean, then what the eye sees, then the customs.
  "ranks-of-liturgical-celebrations",
  "holy-days-of-obligation",
  "glossary-liturgical-colors",
  "glossary-liturgical-vestments",
  "glossary-sacred-vessels",
  "symbolism-of-incense-and-candles",
  "symbolism-of-the-advent-wreath",
  "symbolism-of-the-paschal-candle",
  "angelus-and-regina-caeli",
  "ember-days-and-rogation-days",
];

/**
 * Celebrations whose date moves, at about where each falls in a usual year: a
 * place among the fixed feasts, not a claim about any one year's calendar.
 */
const MOVABLE_DATES: Readonly<Record<string, string>> = {
  "feast-holy-family": "12-29",
  "feast-baptism-of-the-lord": "01-10",
  "solemnity-easter": "04-05",
  "solemnity-ascension": "05-15",
  "solemnity-pentecost": "05-24",
  "solemnity-most-holy-trinity": "06-01",
  "solemnity-corpus-christi": "06-07",
  "solemnity-sacred-heart": "06-12",
  "memorial-immaculate-heart-of-mary": "06-13",
  "solemnity-christ-the-king": "11-23",
};

const LAST = Number.MAX_SAFE_INTEGER;

/** An entry's place: its named place, else its date with the year opening in December. */
function placeOf({ slug, payload }: LiturgyEntry): number {
  const named = NAMED_ORDER.indexOf(slug);
  if (named >= 0) return named;
  const date = MOVABLE_DATES[slug] ?? payload.feastDate;
  const match = typeof date === "string" ? /^(\d{2})-(\d{2})$/.exec(date.trim()) : null;
  return match ? (Number(match[1]) % 12) * 100 + Number(match[2]) : LAST;
}

/** Which section an entry belongs to; one no filter claims comes after them all. */
function sectionIndexOf(entry: LiturgyEntry): number {
  const index = LITURGY_SECTIONS.findIndex((section) => section.matches(entry.payload));
  return index < 0 ? LITURGY_SECTIONS.length : index;
}

/** Every entry, section by section, each section in its own order. */
export function sortLiturgyForDisplay<T extends LiturgyEntry>(entries: readonly T[]): T[] {
  return entries
    .map((entry) => ({ entry, section: sectionIndexOf(entry), place: placeOf(entry) }))
    .sort(
      (a, b) =>
        a.section - b.section || a.place - b.place || a.entry.title.localeCompare(b.entry.title),
    )
    .map(({ entry }) => entry);
}

export interface LiturgySectionGroup<T> {
  key: string;
  /** The section's heading; null for entries no section claims. */
  label: string | null;
  items: T[];
}

/**
 * Entries already in display order, gathered under their sections. A page may
 * begin or end part way through a section, so only the sections it holds appear.
 */
export function groupLiturgySections<T extends LiturgyEntry>(
  entries: readonly T[],
): LiturgySectionGroup<T>[] {
  const groups: LiturgySectionGroup<T>[] = [];
  for (const entry of entries) {
    const section = LITURGY_SECTIONS[sectionIndexOf(entry)];
    const key = section?.key ?? "unsorted";
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(entry);
    else groups.push({ key, label: section?.label ?? null, items: [entry] });
  }
  return groups;
}
