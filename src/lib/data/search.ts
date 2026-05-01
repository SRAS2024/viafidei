import { searchPrayers } from "./prayers";
import { searchSaints } from "./saints";
import { searchApparitions } from "./apparitions";
import { searchParishes } from "./parishes";

export type SearchHits = {
  prayers: Awaited<ReturnType<typeof searchPrayers>>;
  saints: Awaited<ReturnType<typeof searchSaints>>;
  apparitions: Awaited<ReturnType<typeof searchApparitions>>;
  parishes: Awaited<ReturnType<typeof searchParishes>>;
};

const EMPTY_HITS: SearchHits = {
  prayers: [],
  saints: [],
  apparitions: [],
  parishes: [],
};

export async function searchAll(q: string): Promise<SearchHits> {
  if (!q) return EMPTY_HITS;
  const [prayers, saints, apparitions, parishes] = await Promise.all([
    searchPrayers(q),
    searchSaints(q),
    searchApparitions(q),
    searchParishes(q),
  ]);
  return { prayers, saints, apparitions, parishes };
}
