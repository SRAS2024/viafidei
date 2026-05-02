import { prisma } from "../db/client";
import { searchPrayers } from "./prayers";
import { searchSaints } from "./saints";
import { searchApparitions } from "./apparitions";
import { searchParishes } from "./parishes";
import { searchDevotions } from "./devotions";

export type SearchHits = {
  prayers: Awaited<ReturnType<typeof searchPrayers>>;
  saints: Awaited<ReturnType<typeof searchSaints>>;
  apparitions: Awaited<ReturnType<typeof searchApparitions>>;
  parishes: Awaited<ReturnType<typeof searchParishes>>;
  devotions: Awaited<ReturnType<typeof searchDevotions>>;
  liturgy: Awaited<ReturnType<typeof searchLiturgy>>;
  spiritualLife: Awaited<ReturnType<typeof searchSpiritualLife>>;
};

const EMPTY_HITS: SearchHits = {
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
  const [prayers, saints, apparitions, parishes, devotions, liturgy, spiritualLife] =
    await Promise.all([
      searchPrayers(q),
      searchSaints(q),
      searchApparitions(q),
      searchParishes(q),
      searchDevotions(q),
      searchLiturgy(q),
      searchSpiritualLife(q),
    ]);
  return { prayers, saints, apparitions, parishes, devotions, liturgy, spiritualLife };
}

export type SuggestionGroup = "prayers" | "saints" | "apparitions" | "parishes" | "devotions";

export type Suggestion = {
  group: SuggestionGroup;
  id: string;
  slug: string;
  label: string;
};

export async function suggest(q: string, perGroup = 5): Promise<Suggestion[]> {
  if (!q || q.length < 2) return [];
  const [prayers, saints, apparitions, parishes, devotions] = await Promise.all([
    searchPrayers(q, perGroup),
    searchSaints(q, perGroup),
    searchApparitions(q, perGroup),
    searchParishes(q, perGroup),
    searchDevotions(q, perGroup),
  ]);
  const out: Suggestion[] = [];
  for (const p of prayers)
    out.push({ group: "prayers", id: p.id, slug: p.slug, label: p.defaultTitle });
  for (const s of saints)
    out.push({ group: "saints", id: s.id, slug: s.slug, label: s.canonicalName });
  for (const a of apparitions)
    out.push({ group: "apparitions", id: a.id, slug: a.slug, label: a.title });
  for (const p of parishes) out.push({ group: "parishes", id: p.id, slug: p.slug, label: p.name });
  for (const d of devotions)
    out.push({ group: "devotions", id: d.id, slug: d.slug, label: d.title });
  return out;
}
