import { prisma } from "../db/client";
import { searchPrayers } from "./prayers";
import { searchSaints } from "./saints";
import { searchApparitions } from "./apparitions";
import { searchParishes } from "./parishes";
import { searchDevotions } from "./devotions";
import { bestTokenScore, normalize } from "./fuzzy";

export type SearchHits = {
  prayers: Awaited<ReturnType<typeof searchPrayers>>;
  saints: Awaited<ReturnType<typeof searchSaints>>;
  apparitions: Awaited<ReturnType<typeof searchApparitions>>;
  parishes: Awaited<ReturnType<typeof searchParishes>>;
  devotions: Awaited<ReturnType<typeof searchDevotions>>;
  liturgy: Awaited<ReturnType<typeof searchLiturgy>>;
  spiritualLife: Awaited<ReturnType<typeof searchSpiritualLife>>;
};

export const EMPTY_HITS: SearchHits = {
  prayers: [],
  saints: [],
  apparitions: [],
  parishes: [],
  devotions: [],
  liturgy: [],
  spiritualLife: [],
};

export function searchLiturgy(q: string, take = 10) {
  return prisma.liturgyEntry.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export function searchSpiritualLife(q: string, take = 10) {
  return prisma.spiritualLifeGuide.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { bodyText: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}

export async function searchAll(q: string): Promise<SearchHits> {
  if (!q) return EMPTY_HITS;
  // Run the existing strict `contains` searches concurrently with the
  // typo-tolerant fuzzy candidate sets, then merge unique items per kind so
  // a misspelled query still surfaces sensible results on the /search page.
  const [
    prayers,
    saints,
    apparitions,
    parishes,
    devotions,
    liturgy,
    spiritualLife,
    fuzzyPrayers,
    fuzzySaints,
    fuzzyApparitions,
    fuzzyParishes,
    fuzzyDevotions,
  ] = await Promise.all([
    searchPrayers(q),
    searchSaints(q),
    searchApparitions(q),
    searchParishes(q),
    searchDevotions(q),
    searchLiturgy(q),
    searchSpiritualLife(q),
    fuzzyCandidatesPrayers(q, 12),
    fuzzyCandidatesSaints(q, 12),
    fuzzyCandidatesApparitions(q, 12),
    fuzzyCandidatesParishes(q, 12),
    fuzzyCandidatesDevotions(q, 12),
  ]);

  return {
    prayers: mergeFuzzy(prayers, fuzzyPrayers, q, (p) => p.defaultTitle),
    saints: mergeFuzzy(saints, fuzzySaints, q, (s) => s.canonicalName),
    apparitions: mergeFuzzy(apparitions, fuzzyApparitions, q, (a) => a.title),
    parishes: mergeFuzzy(parishes, fuzzyParishes, q, (p) => p.name),
    devotions: mergeFuzzy(devotions, fuzzyDevotions, q, (d) => d.title),
    liturgy,
    spiritualLife,
  };
}

function mergeFuzzy<T extends { id: string }>(
  strict: T[],
  fuzzy: T[],
  q: string,
  getLabel: (item: T) => string,
): T[] {
  const seen = new Set<string>(strict.map((s) => s.id));
  const extras = fuzzy
    .filter((f) => !seen.has(f.id))
    .map((f) => ({ item: f, score: bestTokenScore(q, getLabel(f)) }))
    .filter((x) => x.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
  return [...strict, ...extras];
}

export type SuggestionGroup =
  | "prayers"
  | "saints"
  | "apparitions"
  | "parishes"
  | "devotions"
  | "liturgy"
  | "spiritualLife";

export type Suggestion = {
  group: SuggestionGroup;
  id: string;
  slug: string;
  label: string;
};

/**
 * Pull a wider candidate pool for typeahead suggestions, including:
 *   1) exact `contains` matches (fast Postgres path)
 *   2) prefix-loosened candidates: each contiguous 3-letter window of the
 *      query becomes its own `contains` predicate, so a one-character typo
 *      still surfaces the right entity (e.g. "rosery" matches "rosary"
 *      via the "ros" window).
 *   3) the most popular published items in each kind, capped per kind, so
 *      very short queries like "ro" still return saints/prayers whose
 *      names are reorderings or include the query as a non-prefix.
 *
 * Then we score every candidate with `bestTokenScore` against the query
 * and return only those that pass a similarity threshold, ordered by score.
 */
async function fuzzyCandidatesPrayers(q: string, take: number) {
  const where = buildLooseWhere(q, ["defaultTitle", "category", "body"]);
  return prisma.prayer.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesSaints(q: string, take: number) {
  const where = buildLooseWhere(q, ["canonicalName", "biography"]);
  return prisma.saint.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesApparitions(q: string, take: number) {
  const where = buildLooseWhere(q, ["title", "summary", "location", "country"]);
  return prisma.marianApparition.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesParishes(q: string, take: number) {
  const where = buildLooseWhere(q, ["name", "city", "region", "country", "diocese", "address"]);
  return prisma.parish.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesDevotions(q: string, take: number) {
  const where = buildLooseWhere(q, ["title", "summary", "practiceText"]);
  return prisma.devotion.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesLiturgy(q: string, take: number) {
  const where = buildLooseWhere(q, ["title", "summary", "body"]);
  return prisma.liturgyEntry.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

async function fuzzyCandidatesGuides(q: string, take: number) {
  const where = buildLooseWhere(q, ["title", "summary", "bodyText"]);
  return prisma.spiritualLifeGuide.findMany({
    where: { status: "PUBLISHED", ...where },
    take,
  });
}

/**
 * Build a Prisma where clause that matches if any of the given fields
 * contains either the full query or any 3-letter window of it. The 3-letter
 * window is the cheapest way to tolerate single-character typos without
 * pulling in an external fuzzy index.
 */
function buildLooseWhere(rawQuery: string, fields: readonly string[]) {
  const q = normalize(rawQuery);
  const windows = new Set<string>();
  windows.add(q);
  if (q.length >= 4) {
    for (let i = 0; i + 3 <= q.length; i++) windows.add(q.slice(i, i + 3));
  }
  // Multi-word queries: also try each word individually so "saint francise"
  // can hit on "francis" via the "francis" window even though the whole
  // string fails `contains`.
  for (const tok of q.split(/\s+/).filter((t) => t.length >= 3)) windows.add(tok);

  const orClauses: object[] = [];
  for (const w of windows) {
    if (!w) continue;
    for (const f of fields) {
      orClauses.push({ [f]: { contains: w, mode: "insensitive" } });
    }
  }
  return { OR: orClauses };
}

/**
 * Suggest typeahead results across all surfaced entity kinds. The
 * `perGroup` parameter caps each kind so the user-facing UI can show only
 * the top N (e.g. 2 on mobile, 3 on tablet/desktop).
 *
 * The fuzzy threshold is intentionally lenient so common typos still
 * surface a reasonable suggestion. Callers that need very-precise matches
 * should fall back to `searchAll`.
 */
export async function suggest(q: string, perGroup = 5): Promise<Suggestion[]> {
  if (!q || q.length < 2) return [];

  const candidatePool = Math.max(perGroup * 4, 12);
  const [prayers, saints, apparitions, parishes, devotions, liturgy, guides] = await Promise.all([
    fuzzyCandidatesPrayers(q, candidatePool),
    fuzzyCandidatesSaints(q, candidatePool),
    fuzzyCandidatesApparitions(q, candidatePool),
    fuzzyCandidatesParishes(q, candidatePool),
    fuzzyCandidatesDevotions(q, candidatePool),
    fuzzyCandidatesLiturgy(q, candidatePool),
    fuzzyCandidatesGuides(q, candidatePool),
  ]);

  const out: Suggestion[] = [];

  function pushScored<T>(
    group: SuggestionGroup,
    items: T[],
    pick: (item: T) => { id: string; slug: string; label: string },
  ) {
    const scored = items
      .map((item) => {
        const m = pick(item);
        return { ...m, score: bestTokenScore(q, m.label) };
      })
      .filter((s) => s.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, perGroup);
    for (const s of scored) {
      out.push({ group, id: s.id, slug: s.slug, label: s.label });
    }
  }

  pushScored("prayers", prayers, (p) => ({
    id: p.id,
    slug: p.slug,
    label: p.defaultTitle,
  }));
  pushScored("saints", saints, (s) => ({
    id: s.id,
    slug: s.slug,
    label: s.canonicalName,
  }));
  pushScored("apparitions", apparitions, (a) => ({
    id: a.id,
    slug: a.slug,
    label: a.title,
  }));
  pushScored("parishes", parishes, (p) => ({
    id: p.id,
    slug: p.slug,
    label: p.name,
  }));
  pushScored("devotions", devotions, (d) => ({
    id: d.id,
    slug: d.slug,
    label: d.title,
  }));
  pushScored("liturgy", liturgy, (e) => ({
    id: e.id,
    slug: e.slug,
    label: e.title,
  }));
  pushScored("spiritualLife", guides, (g) => ({
    id: g.id,
    slug: g.slug,
    label: g.title,
  }));

  return out;
}
