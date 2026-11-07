import type { Metadata } from "next";
import { cache } from "react";

import {
  ContentCard,
  FilterChips,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  PaginatedGrid,
} from "@/components/ui";
import { listPageTitleFor } from "@/lib/content-shared/list-page";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { RITE_FILTERS } from "@/lib/content-shared/rite-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ filter?: string; q?: string | string[] }>;

// Rite cards show the rite's history paragraph from the payload, and the rites
// are a short closed list that runs only just past one page of cards, so the
// type is read whole and stays on one page rather than strand a card on a second.
// One read per request: the tab's title and the page both need the answer.
const loadRites = cache(async (filterKey: string, query: string) => {
  const all = await listPublished("RITE");
  const rites = applyPayloadFilter(RITE_FILTERS, all, filterKey);
  // Searched by name, family and region, then the history on the card.
  const visible = query ? rankBySearch(rites, query, (r) => publishedSearchFields(r)) : rites;
  return { all, rites, visible };
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { t, locale } = await getTranslator();
  const { filter, q } = await searchParams;
  const query = parseSearchQuery(q);
  const selected = resolvePayloadFilter(RITE_FILTERS, filter);
  return {
    title: await listPageTitleFor(
      {
        name: t("nav.rites"),
        filter: selected.key === "all" ? null : selected.label,
        query,
        t,
        locale,
      },
      false,
      async () => ({ total: (await loadRites(selected.key, query)).visible.length }),
    ),
  };
}

export default async function RitesPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getTranslator();
  const { filter, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(RITE_FILTERS, filter);
  const [{ all, rites, visible }, selectedRite] = await Promise.all([
    loadRites(selected.key, query),
    getRiteCookieValue(),
  ]);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a family chip when at least one rite falls under it.
  const present = new Set<string>();
  for (const f of RITE_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((r) => f.matches(r.payload))) present.add(f.key);
  }

  return (
    <div>
      <PageHero
        eyebrow="The Catholic Church"
        title="Rites"
        subtitle="The liturgical traditions of the one Catholic Church — the Latin (Roman) Rite and the Eastern Catholic rites — each with its own history."
      />

      <ListControls>
        <ListSearch
          action="/rites"
          query={query}
          label={t("listSearch.rites")}
          keep={keep}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter rites by family"
          activeKey={selected.key}
          items={RITE_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
            key: f.key,
            label: f.label,
            href: listHref("/rites", { filter: f.key === "all" ? undefined : f.key, q: query }),
          }))}
        />
      </ListControls>

      {rites.length === 0 ? (
        <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
          The Catholic rites will appear here as records are approved and published through the
          checklist-first worker.
        </div>
      ) : query && visible.length === 0 ? (
        <ListSearchNoResults action="/rites" query={query} keep={keep} t={t} />
      ) : (
        <PaginatedGrid
          items={visible.map((r) => {
            const payload = r.payload as Record<string, unknown>;
            const history =
              (typeof payload.history === "string" && payload.history) ||
              (typeof payload.background === "string" && payload.background) ||
              "";
            return (
              <ContentCard
                key={r.id}
                href={`/rites/${r.slug}`}
                title={r.title}
                meta={[payload.riteKey === selectedRite ? "Your rite" : null]}
                summary={history}
                action={t("common.open")}
              />
            );
          })}
        />
      )}
    </div>
  );
}
