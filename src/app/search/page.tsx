import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import {
  detectSearchIntent,
  searchAll,
  type SearchIntent,
  EMPTY_HITS,
} from "@/lib/data/search";
import { SearchInput, SearchResultGroup, buildSearchGroups } from "./_components";
import { logger } from "@/lib/observability/logger";

const INTENT_GROUP_KEY: Record<Exclude<SearchIntent, "any">, string> = {
  parish: "parishes",
  saint: "saints",
  prayer: "prayers",
  apparition: "apparitions",
  angel: "saints",
  sacrament: "spiritualLife",
};

const INTENT_LABEL: Record<Exclude<SearchIntent, "any">, string> = {
  parish: "Parishes",
  saint: "Saints",
  prayer: "Prayers",
  apparition: "Marian apparitions",
  angel: "Angels",
  sacrament: "Sacraments & consecrations",
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const { t } = await getTranslator();
  const q = (searchParams.q ?? "").trim();

  let hits: Awaited<ReturnType<typeof searchAll>>;
  try {
    hits = await searchAll(q);
  } catch (err) {
    logger.error("search.page_failed", { q, error: (err as Error).message });
    hits = EMPTY_HITS;
  }
  const groups = buildSearchGroups(hits, t);
  const total = groups.reduce((acc, g) => acc + g.count, 0);
  const intent = detectSearchIntent(q);
  const intentGroupKey = intent !== "any" ? INTENT_GROUP_KEY[intent] : null;

  // When the query carries a clear content-type intent, surface the
  // matching group first so a "Boston MA" search lands on parishes
  // and a "Saint Therese" search lands on saints. Other groups still
  // render below in their canonical order.
  const orderedGroups = intentGroupKey
    ? [
        ...groups.filter((g) => g.key === intentGroupKey),
        ...groups.filter((g) => g.key !== intentGroupKey),
      ]
    : groups;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.search")}
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <SearchInput
        defaultValue={q}
        placeholder={t("search.placeholder")}
        ariaLabel={t("nav.search")}
        submitLabel={t("nav.search")}
      />

      {q ? (
        <div className="mb-8 text-center font-serif text-ink-faint">
          <p>
            {total === 0
              ? t("search.noResults")
              : t("search.resultsCount", { count: total, query: q })}
          </p>
          {intent !== "any" && total > 0 ? (
            <p className="mt-1 text-xs">
              Showing {INTENT_LABEL[intent].toLowerCase()} first based on your query.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        {orderedGroups
          .filter((g) => g.count > 0)
          .map((g) => (
            <SearchResultGroup key={g.key} group={g} query={q} />
          ))}
      </div>
    </div>
  );
}
