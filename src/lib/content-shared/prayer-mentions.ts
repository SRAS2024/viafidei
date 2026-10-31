/**
 * Finding the prayers a piece of text names.
 *
 * Guides, novenas, devotions and the Rosary and chaplet prayers refer to other
 * prayers by name — "pray the Our Father", "three Hail Marys", "conclude with
 * the Hail, Holy Queen". Those names become inline-expandable prayers (with
 * the Latin / Greek toggle) in `PrayerLinkedText`, and the server pages use the
 * same matcher to work out which prayers a novena actually prays. It lives here,
 * outside the client component, because a server component cannot call a
 * function exported from a "use client" module.
 *
 * Matching is conservative. Punctuation must be as written, a plural ("Hail
 * Marys") only counts when the name is cased exactly as written ("our fathers"
 * is a psalm or a canticle, never a rubric), and an opening phrase such as "O my
 * Jesus" is not a name. Over text that is itself prayer — a prayer's body, a
 * novena day — `matchCase` also requires the first word to be capitalised as a
 * name ("Our Father", never "our father Abraham").
 */

/** The fields of a prayer the matcher needs. */
export interface MentionablePrayer {
  slug: string;
  title: string;
}

/**
 * Alternate names a prayer is referred to by, keyed by slug. The prayer's own
 * title (and any parenthetical in it, e.g. "(Salve Regina)") is always matched
 * too; these only add the forms a title can't yield — Latin incipits,
 * traditional English names, missing apostrophes and the abbreviations guides
 * use.
 */
const PRAYER_ALIASES: Record<string, string[]> = {
  "apostles-creed": ["Apostle's Creed", "Apostles Creed"],
  "our-father": ["Lord's Prayer", "Pater Noster"],
  "hail-mary": ["Ave Maria"],
  "glory-be": ["Gloria Patri", "Doxology"],
  "salve-regina": ["Salve Regina", "Hail, Holy Queen"],
  "prayer-to-saint-michael": ["Prayer to Saint Michael", "St. Michael Prayer"],
  "veni-creator-spiritus": ["Veni Creator"],
  angelus: ["Angelus"],
  "divine-praises": ["Divine Praises"],
};

/**
 * Title parentheticals that are a prayer's opening words rather than its name.
 * "O my Jesus" opens the Fatima Prayer and also any number of other prayers, so
 * it is never read as a mention of it.
 */
const INCIPITS_NOT_NAMES: Record<string, string[]> = {
  "fatima-prayer": ["O My Jesus"],
};

/**
 * The prayers other prayers and devotions name as units: the building blocks
 * of the Rosary, the chaplets and most novenas. A page with no explicit prayer
 * list of its own looks for these in its text.
 */
export const BUILDING_BLOCK_PRAYERS: readonly string[] = [
  "sign-of-the-cross",
  "apostles-creed",
  "our-father",
  "hail-mary",
  "glory-be",
  "fatima-prayer",
  "salve-regina",
  "prayer-to-saint-michael",
  "memorare",
  "act-of-contrition",
  "angelus",
  "eternal-rest",
];

/** Fold the various apostrophes to a straight one so matching is robust. */
function foldApostrophes(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The lookup key for a name or a matched span: case, commas and spacing folded. */
function nameKey(s: string): string {
  return foldApostrophes(s)
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

/** Names a prayer may be referred to by — its title (cleaned) plus aliases. */
function candidateNames(p: MentionablePrayer): string[] {
  const names = new Set<string>();
  const title = p.title.trim();
  // The bare title, only when it has no parenthetical (those are split out below).
  if (!/[()]/.test(title)) names.add(title);
  const noParen = title
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (noParen) names.add(noParen);
  for (const m of title.matchAll(/\(([^)]+)\)/g)) {
    const inner = m[1].trim();
    if (inner) names.add(inner);
  }
  for (const a of PRAYER_ALIASES[p.slug] ?? []) names.add(a);
  const incipits = new Set((INCIPITS_NOT_NAMES[p.slug] ?? []).map(nameKey));
  return [...names].filter((n) => n.length >= 3 && !/[()]/.test(n) && !incipits.has(nameKey(n)));
}

/**
 * The regex source for one name. Punctuation is literal — a comma is matched
 * only where a name (or alias) has one, so "Hail, Holy Queen" is an alias
 * rather than every "Ave, Maria" in a hymn refrain reading as the Hail Mary.
 * With `matchCase` the first word must be cased exactly as written and each
 * later word may have its initial in either case ("Glory be to the Father").
 */
function namePattern(name: string, matchCase: boolean): string {
  return foldApostrophes(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const initial = word.charAt(0);
      if (!matchCase || i === 0 || initial.toLowerCase() === initial.toUpperCase()) {
        return escapeRegExp(word);
      }
      return `[${initial.toUpperCase()}${initial.toLowerCase()}]${escapeRegExp(word.slice(1))}`;
    })
    .join("\\s+");
}

export interface MentionSegment<P extends MentionablePrayer> {
  text: string;
  prayer?: P;
}

export interface MentionOptions {
  /**
   * Require a name's first word to be capitalised as written. On for text that
   * is itself prayer (a prayer's body, a novena day), where "our father" and
   * "eternal rest" are ordinary words; off for instructions ("make an act of
   * spiritual communion"), which name prayers in running prose.
   */
  matchCase?: boolean;
}

/**
 * Splits `text` into plain runs and runs that name one of `prayers`. Returns
 * the segments (which concatenate back to `text` exactly) and the prayers
 * named, in the order they are first named.
 */
export function tokenizePrayerMentions<P extends MentionablePrayer>(
  text: string,
  prayers: readonly P[],
  { matchCase = false }: MentionOptions = {},
): { segments: MentionSegment<P>[]; matched: P[] } {
  const byKey = new Map<string, P>();
  const exact = new Map<string, P>();
  for (const p of prayers) {
    for (const n of candidateNames(p)) {
      const key = nameKey(n);
      if (!byKey.has(key)) byKey.set(key, p);
      const folded = foldApostrophes(n);
      if (!exact.has(folded)) exact.set(folded, p);
    }
  }
  const names = [...exact.keys()].sort((a, b) => b.length - a.length);
  if (names.length === 0) return { segments: [{ text }], matched: [] };

  // Longest names first so "Hail Holy Queen" wins over a shorter overlap; the
  // optional trailing "s" lets "Hail Marys" reach the "Hail Mary" entry.
  const pattern = new RegExp(
    `\\b(${names.map((n) => namePattern(n, matchCase)).join("|")})(s)?\\b`,
    matchCase ? "g" : "gi",
  );
  const folded = foldApostrophes(text); // 1:1 length-preserving → indices align

  const segments: MentionSegment<P>[] = [];
  const matched = new Map<string, P>();
  let last = 0;
  for (const m of folded.matchAll(pattern)) {
    const idx = m.index ?? 0;
    const whole = m[0];
    const base = m[1] ?? whole;
    // A plural only counts when the name is cased exactly as written:
    // "Hail Marys" is a rubric, "Our fathers" is a psalm.
    const prayer = m[2] && !exact.has(base) ? undefined : byKey.get(nameKey(base));
    if (!prayer) continue;
    if (idx > last) segments.push({ text: text.slice(last, idx) });
    segments.push({ text: text.slice(idx, idx + whole.length), prayer });
    matched.set(prayer.slug, prayer);
    last = idx + whole.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return { segments, matched: [...matched.values()] };
}

/**
 * The prayers named anywhere in `texts`, in the order they are first named.
 * Used to decide which prayers a novena or a Rosary/chaplet text actually
 * prays, so its prayer list holds what the reader is told to pray and nothing
 * else.
 */
export function prayersMentionedIn<P extends MentionablePrayer>(
  texts: ReadonlyArray<string>,
  prayers: readonly P[],
  options: MentionOptions = {},
): P[] {
  const joined = texts.filter((t) => t.trim()).join("\n\n");
  if (!joined) return [];
  return tokenizePrayerMentions(joined, prayers, options).matched;
}
